import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import AppShell from '../components/AppShell.vue';

// Mocks similar to overwrite test, but simulate EXIF missing and browser geo success
vi.mock('../stores/auth', () => ({ useAuthStore: (): { user: null; isAuthenticated: boolean } => ({ user: null, isAuthenticated: false }) }));
vi.mock('../stores/fastUploadSession', () => ({
  useFastUploadSessionStore: (): { setSession: (p: unknown) => void; clear: () => void } => ({ setSession: vi.fn(), clear: vi.fn() })
}));
vi.mock('../stores/ui', () => ({ useUIStore: (): Record<string, never> => ({}) }));
vi.mock('../stores/search', () => ({ useSearchStore: (): Record<string, never> => ({}) }));
const pushSpy = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: (): { path: string; fullPath: string; params: Record<string, unknown>; query: Record<string, unknown> } => ({ path: '/', fullPath: '/', params: {}, query: {} }),
  useRouter: (): { push: (p: string) => void } => ({ push: pushSpy }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
  RouterView: { name: 'RouterView', template: '<div />' },
}));
// Geolocation success
vi.mock('../composables/useGeolocation', () => ({ useGeolocation: (): { getCurrentPosition: () => Promise<{ latitude: number; longitude: number }> } => ({ getCurrentPosition: vi.fn().mockResolvedValue({ latitude: 1.23, longitude: 4.56 }) }) }));
vi.mock('../utils/image', async (original: () => Promise<unknown>) => {
  const actual = await original();
  return {
    ...(actual as Record<string, unknown>),
    createImagePreview: (f: File): Promise<string> => Promise.resolve('preview-'+f.name),
    extractExifData: async (): Promise<Record<string, never>> => ({})
  };
});

function makeFile(name: string): File { return new File(['data'], name, { type: 'image/jpeg' }); }

async function triggerAddWithFiles(wrapper: ReturnType<typeof mount>, files: File[]): Promise<void> {
  const inputs = wrapper.findAll('input[type="file"]');
  const input = inputs[0];
  if (!input) throw new Error('No file input');
  Object.defineProperty(input.element as HTMLInputElement, 'files', { value: files, configurable: true });
  await input.trigger('change');
}

async function flush(): Promise<void> { await new Promise(r => setTimeout(r, 0)); }
globalThis.alert = (): void => {};

describe('AppShell Fast Add geolocation fallback', () => {
  it('uses browser geolocation when EXIF absent and navigates with coordinates', async () => {
    const wrapper = mount(AppShell);
  await triggerAddWithFiles(wrapper, [makeFile('geo.jpg')]);
  await flush();
    // Expect router push invoked with lat/lng query params
    const pushed = pushSpy.mock.calls.map(c => c[0] as string);
    const fastSearchNav = pushed.find(p => /\/search\?/.test(p));
    expect(fastSearchNav).toBeTruthy();
    expect(fastSearchNav).toMatch(/lat=1\.23/);
    expect(fastSearchNav).toMatch(/lng=4\.56/);
  });
});
