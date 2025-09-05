import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { createPinia, type Pinia } from 'pinia';
import SubmitView from '../SubmitView.vue';

// Mock child components
vi.mock('../../components/PhotoUpload.vue', () => ({
  default: {
    name: 'PhotoUpload',
    template:
      '<div data-testid="photo-upload"><button @click="$emit(\'uploadSuccess\', mockData)">Upload Photos</button></div>',
    props: ['userToken'],
    emits: ['uploadSuccess', 'uploadError', 'cancel'],
    setup(): { mockData: any } {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      const mockData = {
        submission_id: 'test-submission-id',
        photos: ['photo1.jpg', 'photo2.jpg'],
      };
      return { mockData };
    },
  },
}));

const createMockRouter = (): Router => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/submit', component: { template: '<div>Submit</div>' } },
    ],
  });
};

describe('SubmitView', () => {
  let wrapper: VueWrapper<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let router: Router;
  let pinia: Pinia;

  beforeEach(async (): Promise<void> => {
    pinia = createPinia();
    router = createMockRouter();

    wrapper = mount(SubmitView, {
      global: {
        plugins: [router, pinia],
      },
    });

    await wrapper.vm.$nextTick();
  });

  describe('Basic Rendering', (): void => {
    it('renders the submit page', (): void => {
      expect(wrapper.exists()).toBe(true);
    });

    it('shows step 1 initially', (): void => {
      expect(wrapper.vm.currentStep).toBe(1);
    });

    it('contains photo upload component', (): void => {
      expect(wrapper.find('[data-testid="photo-upload"]').exists()).toBe(true);
    });
  });

  describe('Success Notifications', (): void => {
    it('shows success notification when upload completes', async (): Promise<void> => {
      // Initially no success notification
      expect(wrapper.find('[role="alert"][aria-live="polite"]').exists()).toBe(false);

      // Simulate successful upload by emitting the success event
      const photoUpload = wrapper.findComponent({ name: 'PhotoUpload' });
      expect(photoUpload.exists()).toBe(true);

      const mockSubmissionData = {
        submission_id: 'test-submission-id',
        photos: ['photo1.jpg', 'photo2.jpg'],
        latitude: 49.2827,
        longitude: -123.1207,
        note: 'Test artwork submission',
      };

      await photoUpload.vm.$emit('uploadSuccess', mockSubmissionData);
      await wrapper.vm.$nextTick();

      // Should show success notification
      const successAlert = wrapper.find('[role="alert"][aria-live="polite"]');
      expect(successAlert.exists()).toBe(true);
      expect(successAlert.text()).toContain('Submission Successful!');
      expect(successAlert.text()).toContain(
        'Your artwork submission has been received and will be reviewed shortly.'
      );

      // Should show "Submit another artwork" button
      const newSubmissionButton = wrapper.find('button');
      expect(newSubmissionButton.exists()).toBe(true);
      expect(newSubmissionButton.text()).toContain('Submit another artwork');
    });

    it('can start a new submission after success', async (): Promise<void> => {
      // Simulate successful upload
      const photoUpload = wrapper.findComponent({ name: 'PhotoUpload' });
      const mockSubmissionData = {
        submission_id: 'test-submission-id',
        photos: ['photo1.jpg'],
      };

      await photoUpload.vm.$emit('uploadSuccess', mockSubmissionData);
      await wrapper.vm.$nextTick();

      // Should show success state
      expect(wrapper.vm.success).toBe(true);

      // Click "Submit another artwork" button
      const newSubmissionButton = wrapper.find('button');
      await newSubmissionButton.trigger('click');
      await wrapper.vm.$nextTick();

      // Should reset to initial state
      expect(wrapper.vm.success).toBe(false);
      expect(wrapper.vm.currentStep).toBe(1);
      expect(wrapper.vm.submissionData).toBe(null);
      expect(wrapper.vm.error).toBe(null);
    });
  });
});
