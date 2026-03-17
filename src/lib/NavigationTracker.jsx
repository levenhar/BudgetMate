import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        // Navigation tracking - can be extended with analytics if needed
    }, [location]);

    return null;
}
