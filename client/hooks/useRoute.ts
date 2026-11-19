// React imports
import { useCallback, useMemo, useSyncExternalStore } from 'react';

const EVENT = 'tickfit:route';

type tParams = Record<string, string | undefined>;

interface iRoute {
    /** The parts of the path: #/day/abc → ['day', 'abc'] */
    path: string[];
    params: URLSearchParams;
}

const subscribe = (notify: () => void) => {
    window.addEventListener('hashchange', notify);
    window.addEventListener(EVENT, notify);
    return () => {
        window.removeEventListener('hashchange', notify);
        window.removeEventListener(EVENT, notify);
    };
};

const hashOf = (): string => window.location.hash.slice(1);

const parse = (hash: string): iRoute => {
    const [path, query = ''] = hash.split('?');
    return {
        path: path.split('/').filter(Boolean).map(decodeURIComponent),
        params: new URLSearchParams(query),
    };
};

const build = (path: string[], params: tParams): string => {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
    return `#/${path.map(encodeURIComponent).join('/')}${query ? `?${query}` : ''}`;
};

/**
 * Where the app is, kept in the address (#/day/abc?w=2026-05-04) so a reload lands on the same page. Moving does not
 * add history entries: the back gesture of a phone is held (see lockGestures), the app has its own back buttons.
 */
const navigate = (path: string[], params: tParams = {}) => {
    window.history.replaceState(window.history.state, '', build(path, params));
    window.dispatchEvent(new Event(EVENT));
};

const useRoute = (): iRoute & { go: (path: string[], params?: tParams) => void } => {
    const hash = useSyncExternalStore(subscribe, hashOf, () => '');
    const route = useMemo(() => parse(hash), [hash]);
    return { ...route, go: navigate };
};

/** One value of the address, for what a page remembers (a filter, a tab, a week). The fallback is left out of the address. */
const useParam = (key: string, fallback = ''): [string, (value: string) => void] => {
    const hash = useSyncExternalStore(subscribe, hashOf, () => '');
    const value = useMemo(() => parse(hash).params.get(key) ?? fallback, [fallback, hash, key]);
    const set = useCallback(
        (next: string) => {
            const { params, path } = parse(hashOf());
            navigate(path, { ...Object.fromEntries(params), [key]: next === fallback ? undefined : next });
        },
        [fallback, key],
    );
    return [value, set];
};

/** A switch in the address (?archived=1) */
const useFlag = (key: string): [boolean, (on: boolean) => void] => {
    const [value, set] = useParam(key);
    return [value === '1', (on) => set(on ? '1' : '')];
};

/** The row that is open in a list (?id=...), null when there is none */
const useSelected = (): [string | null, (id: string | null) => void] => {
    const [id, set] = useParam('id');
    return [id || null, (next) => set(next ?? '')];
};

export { navigate, useFlag, useParam, useRoute, useSelected };
export type { tParams };
