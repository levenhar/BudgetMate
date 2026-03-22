// tests/qa/helpers/auth.js
const BASE_URL = 'http://localhost:5173';

export async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login'), { timeout: 20000 });
  await page.waitForTimeout(1500); // let React Query settle
}

export async function signOut(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
}

export const QA_USERS = {
  a: { email: 'qa-user-a@budgetmate.test', password: 'QAtest!2026' },
  b: { email: 'qa-user-b@budgetmate.test', password: 'QAtest!2026' },
  c: { email: 'qa-user-c@budgetmate.test', password: 'QAtest!2026' },
};

export const BASE_URL_EXPORT = BASE_URL;
