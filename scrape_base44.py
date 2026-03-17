"""
Playwright script to extract all files from a Base44 project editor.
Opens a headed browser. Log in, navigate to the editor, then click Resume.
Does NOT reload the page — works with the live editor session.
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

TARGET_URL = "https://app.base44.com/apps/69582269f13402a151c116ad/editor/workspace/code"
OUTPUT_DIR = Path(__file__).parent


async def read_editor_content(page):
    """Read content from Monaco, CodeMirror, or any editor on the page."""
    return await page.evaluate("""
    () => {
        // Monaco editor (Base44 likely uses this)
        if (window.monaco) {
            const editors = monaco.editor.getEditors();
            if (editors.length > 0) return editors[0].getValue();
        }
        // CodeMirror 5
        const cm5 = document.querySelector('.CodeMirror');
        if (cm5 && cm5.CodeMirror) return cm5.CodeMirror.getValue();
        // Generic contenteditable in editor area
        const editorArea = document.querySelector(
            '[class*="editor"] [contenteditable="true"], ' +
            '[class*="Editor"] [contenteditable="true"]'
        );
        if (editorArea) return editorArea.innerText;
        // Textarea fallback
        const ta = document.querySelector('.monaco-editor textarea');
        if (ta) return ta.value;
        return null;
    }
    """)


async def dump_dom_info(page):
    """Dump file-related DOM elements to understand the structure."""
    info = await page.evaluate("""
    () => {
        const dump = [];
        document.querySelectorAll('*').forEach(el => {
            const cls = (el.className || '').toString();
            const id = el.id || '';
            if ((cls + id).toLowerCase().match(/file|tree|sidebar|explorer|panel|navigator/)) {
                dump.push({
                    tag: el.tagName,
                    cls: cls.substring(0, 120),
                    id,
                    text: el.textContent?.trim().substring(0, 80),
                    childCount: el.children.length
                });
            }
        });
        return dump.slice(0, 80);
    }
    """)
    return info


async def find_all_file_elements(page):
    """Return all elements that look like file tree items."""
    selectors = [
        '[role="treeitem"]',
        '[class*="file-item"]',
        '[class*="FileItem"]',
        '[class*="file-row"]',
        '[class*="FileRow"]',
        '[class*="tree-node"]',
        '[class*="TreeNode"]',
        '[class*="file-label"]',
        '[class*="fileName"]',
        '[class*="file_name"]',
        '[data-type="file"]',
        '[class*="listItem"]',
        '[class*="list-item"]',
    ]
    for sel in selectors:
        items = await page.query_selector_all(sel)
        if items:
            print(f"  Found {len(items)} items with: {sel}")
            return items, sel
    return [], None


async def try_monaco_file_list(page):
    """If Monaco is present, try to enumerate its file models."""
    return await page.evaluate("""
    () => {
        if (!window.monaco) return null;
        const models = monaco.editor.getModels();
        return models.map(m => ({
            uri: m.uri.toString(),
            content: m.getValue()
        }));
    }
    """)


async def try_react_fiber(page):
    """
    Walk React fiber tree to find file list data baked into component state.
    Returns a list of {name, content} dicts if found.
    """
    return await page.evaluate("""
    () => {
        function getReactFiber(el) {
            for (const key of Object.keys(el)) {
                if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
                    return el[key];
                }
            }
            return null;
        }
        function walk(fiber, depth, results) {
            if (!fiber || depth > 30) return;
            try {
                const props = fiber.memoizedProps || {};
                const state = fiber.memoizedState;
                // Look for file-like props
                for (const key of Object.keys(props)) {
                    const val = props[key];
                    if (Array.isArray(val)) {
                        for (const item of val) {
                            if (item && typeof item === 'object' && typeof item.content === 'string' && item.name) {
                                results.push({ name: item.name, path: item.path || item.name, content: item.content });
                            }
                        }
                    }
                    if (val && typeof val === 'object' && typeof val.content === 'string' && val.name) {
                        results.push({ name: val.name, path: val.path || val.name, content: val.content });
                    }
                }
            } catch(e) {}
            walk(fiber.child, depth + 1, results);
            walk(fiber.sibling, depth + 1, results);
        }
        const results = [];
        const root = document.querySelector('#root') || document.body;
        const fiber = getReactFiber(root);
        if (fiber) walk(fiber, 0, results);
        return results;
    }
    """)


async def find_files_in_network(captured):
    """Scan network responses for file content."""
    files = {}

    def walk(obj, path=""):
        if isinstance(obj, dict):
            for key in ('content', 'code', 'source', 'body', 'text'):
                if key in obj and isinstance(obj.get(key), str) and len(obj[key]) > 10:
                    name = obj.get('name') or obj.get('path') or obj.get('filename') or path
                    if name and '.' in str(name).split('/')[-1]:
                        files[str(name)] = obj[key]
            for k, v in obj.items():
                walk(v, path + '/' + k if path else k)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, path)

    for url, data in captured.items():
        walk(data)

    return files


async def save_files(files_dict: dict, base_path: Path):
    saved = 0
    for filepath, content in files_dict.items():
        if not content:
            continue
        clean = str(filepath).lstrip('/').lstrip('\\')
        dest = base_path / clean
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            dest.write_text(content, encoding='utf-8')
            print(f"  Saved: {clean}")
            saved += 1
        except Exception as e:
            print(f"  Error saving {clean}: {e}")
    print(f"\nTotal files saved: {saved}")
    return saved


async def main():
    # Collect network responses passively (no reload)
    captured_net = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=['--start-maximized'])
        context = await browser.new_context()
        page = await context.new_page()

        # Attach response listener BEFORE navigation
        async def on_response(response):
            try:
                ct = response.headers.get('content-type', '')
                if 'json' in ct:
                    body = await response.json()
                    captured_net[response.url] = body
            except Exception:
                pass

        page.on('response', on_response)

        print(f"Opening: {TARGET_URL}")
        await page.goto(TARGET_URL, timeout=60_000)

        print("\n=== ACTION REQUIRED ===")
        print("1. Log in to Base44 in the browser window.")
        print("2. Navigate to your project's code editor.")
        print("3. Make sure the file tree is visible.")
        print("4. Click the 'Resume' button in the Playwright toolbar to continue.")
        await page.pause()
        print("Resumed. Starting extraction...")
        await page.wait_for_timeout(2000)  # Let any lazy loads settle

        all_files = {}

        # --- Strategy 1: Monaco file models ---
        print("\n[1] Checking Monaco editor models...")
        monaco_models = await try_monaco_file_list(page)
        if monaco_models:
            print(f"  Found {len(monaco_models)} Monaco models")
            for m in monaco_models:
                uri = m['uri']
                # Strip protocol prefix like inmemory://model/ or file:///
                name = uri.split('/')[-1] if '/' in uri else uri
                all_files[name] = m['content']
                print(f"    {uri}")
        else:
            print("  Monaco not found or no models open")

        # --- Strategy 2: React fiber walk ---
        print("\n[2] Walking React component state...")
        react_files = await try_react_fiber(page)
        if react_files:
            print(f"  Found {len(react_files)} files in React state")
            for f in react_files:
                all_files[f['path']] = f['content']
                print(f"    {f['path']}")
        else:
            print("  No files found in React state")

        # --- Strategy 3: Network responses ---
        print(f"\n[3] Checking {len(captured_net)} captured network responses...")
        net_files = await find_files_in_network(captured_net)
        if net_files:
            print(f"  Found {len(net_files)} files in network responses")
            for name in net_files:
                all_files[name] = net_files[name]
                print(f"    {name}")
        else:
            print("  No files found in network responses")

        # Save network data for manual inspection
        with open(OUTPUT_DIR / 'captured_network.json', 'w', encoding='utf-8') as f:
            json.dump(captured_net, f, indent=2, default=str)

        # --- Strategy 4: Click file tree items ---
        print("\n[4] Looking for file tree to click...")
        file_items, selector = await find_all_file_elements(page)
        if file_items:
            print(f"  Clicking {len(file_items)} items...")
            for item in file_items:
                try:
                    label = (await item.text_content() or "").strip()
                    if not label or '.' not in label.split('/')[-1]:
                        continue
                    path = (await item.get_attribute('data-path')
                            or await item.get_attribute('title')
                            or label)
                    print(f"    Clicking: {path}")
                    await item.click()
                    await page.wait_for_timeout(1000)
                    content = await read_editor_content(page)
                    if content:
                        all_files[path] = content
                        print(f"      {len(content)} chars")
                except Exception as e:
                    print(f"      Error: {e}")
        else:
            print("  No file tree items found")

        # --- DOM dump for debugging ---
        print("\n[5] Saving DOM dump for manual analysis...")
        dom_info = await dump_dom_info(page)
        with open(OUTPUT_DIR / 'dom_dump.json', 'w', encoding='utf-8') as f:
            json.dump(dom_info, f, indent=2)
        html = await page.content()
        (OUTPUT_DIR / 'base44_page_dump.html').write_text(html, encoding='utf-8')
        print("  Saved dom_dump.json and base44_page_dump.html")

        # --- Save results ---
        print(f"\n=== SUMMARY: {len(all_files)} files extracted ===")
        if all_files:
            await save_files(all_files, OUTPUT_DIR)
        else:
            print("No files could be extracted automatically.")
            print("Check dom_dump.json and captured_network.json to understand the page structure.")
            print("You may need to expand the file tree manually before clicking Resume.")

        print("\nBrowser will stay open for 20s for inspection...")
        await page.wait_for_timeout(20_000)
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
