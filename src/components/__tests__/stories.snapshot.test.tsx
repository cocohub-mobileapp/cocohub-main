// Mock all component modules used in story files
jest.mock('../EmergencyCallButton', () => ({ __esModule: true, default: 'EmergencyCallButton' }));
jest.mock('../ErrorBoundary', () => ({ __esModule: true, ErrorBoundary: 'ErrorBoundary' }));
jest.mock('../ErrorFallback', () => ({ __esModule: true, default: 'ErrorFallback' }));
jest.mock('../LanguageSelector', () => ({ __esModule: true, default: 'LanguageSelector' }));
jest.mock('../LazyScreen', () => ({ __esModule: true, default: 'LazyScreen' }));
jest.mock('../MedicalRecordAttachments', () => ({
  __esModule: true,
  default: 'MedicalRecordAttachments',
}));
jest.mock('../MetricBarChart', () => ({ __esModule: true, default: 'MetricBarChart' }));
jest.mock('../OfflineIndicator', () => ({ __esModule: true, default: 'OfflineIndicator' }));
jest.mock('../OptimizedImage', () => ({ __esModule: true, OptimizedImage: 'OptimizedImage' }));
jest.mock('../PermissionRationaleModal', () => ({
  __esModule: true,
  default: 'PermissionRationaleModal',
}));
jest.mock('../PetAggregateView', () => ({ __esModule: true, default: 'PetAggregateView' }));
jest.mock('../PetPhotoUploader', () => ({
  __esModule: true,
  PetPhotoUploader: 'PetPhotoUploader',
}));
jest.mock('../PetSelectorBar', () => ({ __esModule: true, default: 'PetSelectorBar' }));
jest.mock('../QRCodeDisplay', () => ({ __esModule: true, default: 'QRCodeDisplay' }));
jest.mock('../ReminderSnoozeModal', () => ({ __esModule: true, default: 'ReminderSnoozeModal' }));
jest.mock('../RetryError', () => ({ __esModule: true, RetryError: 'RetryError' }));
jest.mock('../SecureView', () => ({ __esModule: true, default: 'SecureView' }));
jest.mock('../SOSButton', () => ({ __esModule: true, default: 'SOSButton' }));
jest.mock('../ThemedStatusBar', () => ({ __esModule: true, default: 'ThemedStatusBar' }));
jest.mock('../UpdatePrompt', () => ({ __esModule: true, default: 'UpdatePrompt' }));
jest.mock('../VerificationBadge', () => ({
  __esModule: true,
  VerificationBadge: 'VerificationBadge',
}));
jest.mock('../VetVerifiedBadge', () => ({
  __esModule: true,
  VetVerifiedBadge: 'VetVerifiedBadge',
}));
jest.mock('../WeightChart', () => ({ __esModule: true, default: 'WeightChart' }));
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { t: (k: string) => k, language: 'en', changeLanguage: jest.fn() },
}));
jest.mock('../../context/PetContext', () => {
  const React = require('react');
  return {
    __esModule: true,
    PetContext: React.createContext(null),
    usePetContext: jest.fn(),
  };
});
jest.mock('../../services/reminderService', () => {
  const mockReminderService: any = { getSuggestedTime: jest.fn(), snooze: jest.fn() };
  return { reminderService: mockReminderService };
});
jest.mock('../../models/Pet', () => ({ __esModule: true, createPet: (p: any) => p }));

// Import story modules (using * as to get all exports)
import * as EmergencyCallButtonModule from '../EmergencyCallButton.stories';
import * as ErrorBoundaryModule from '../ErrorBoundary.stories';
import * as ErrorFallbackModule from '../ErrorFallback.stories';
import * as LanguageSelectorModule from '../LanguageSelector.stories';
import * as LazyScreenModule from '../LazyScreen.stories';
import * as MedicalRecordAttachmentsModule from '../MedicalRecordAttachments.stories';
import * as MetricBarChartModule from '../MetricBarChart.stories';
import * as OfflineIndicatorModule from '../OfflineIndicator.stories';
import * as OptimizedImageModule from '../OptimizedImage.stories';
import * as PermissionRationaleModalModule from '../PermissionRationaleModal.stories';
import * as PetAggregateViewModule from '../PetAggregateView.stories';
import * as PetPhotoUploaderModule from '../PetPhotoUploader.stories';
import * as PetSelectorBarModule from '../PetSelectorBar.stories';
import * as QRCodeDisplayModule from '../QRCodeDisplay.stories';
import * as ReminderSnoozeModalModule from '../ReminderSnoozeModal.stories';
import * as RetryErrorModule from '../RetryError.stories';
import * as SecureViewModule from '../SecureView.stories';
import * as SOSButtonModule from '../SOSButton.stories';
import * as ThemedStatusBarModule from '../ThemedStatusBar.stories';
import * as UpdatePromptModule from '../UpdatePrompt.stories';
import * as VerificationBadgeModule from '../VerificationBadge.stories';
import * as VetVerifiedBadgeModule from '../VetVerifiedBadge.stories';
import * as WeightChartModule from '../WeightChart.stories';

interface SnapshotTestCase {
  name: string;
  module: Record<string, unknown>;
  expectedTitle: string;
  expectedStories: string[];
}

describe('Storybook component snapshots', () => {
  const testCases: SnapshotTestCase[] = [
    {
      name: 'EmergencyCallButton',
      module: EmergencyCallButtonModule as any,
      expectedTitle: 'Components/EmergencyCallButton',
      expectedStories: ['Default', 'NumberOnly', 'Compact', 'SkipConfirm'],
    },
    {
      name: 'ErrorBoundary',
      module: ErrorBoundaryModule as any,
      expectedTitle: 'Components/ErrorBoundary',
      expectedStories: ['WithChildren', 'ErrorFallback'],
    },
    {
      name: 'ErrorFallback',
      module: ErrorFallbackModule as any,
      expectedTitle: 'Components/ErrorFallback',
      expectedStories: ['Default', 'CustomHandlers', 'MinimalConfig', 'Dark'],
    },
    {
      name: 'LanguageSelector',
      module: LanguageSelectorModule as any,
      expectedTitle: 'Components/LanguageSelector',
      expectedStories: ['Default', 'Dark'],
    },
    {
      name: 'LazyScreen',
      module: LazyScreenModule as any,
      expectedTitle: 'Components/LazyScreen',
      expectedStories: ['Default'],
    },
    {
      name: 'MedicalRecordAttachments',
      module: MedicalRecordAttachmentsModule as any,
      expectedTitle: 'Components/MedicalRecordAttachments',
      expectedStories: ['Default'],
    },
    {
      name: 'MetricBarChart',
      module: MetricBarChartModule as any,
      expectedTitle: 'Components/MetricBarChart',
      expectedStories: ['WeightTrend', 'HeartRate', 'SinglePoint', 'Empty'],
    },
    {
      name: 'OfflineIndicator',
      module: OfflineIndicatorModule as any,
      expectedTitle: 'Components/OfflineIndicator',
      expectedStories: ['Default', 'OfflineState', 'SyncingState', 'PendingState'],
    },
    {
      name: 'OptimizedImage',
      module: OptimizedImageModule as any,
      expectedTitle: 'Components/OptimizedImage',
      expectedStories: ['Default', 'AvatarSize', 'ErrorState'],
    },
    {
      name: 'PermissionRationaleModal',
      module: PermissionRationaleModalModule as any,
      expectedTitle: 'Components/PermissionRationaleModal',
      expectedStories: ['Camera', 'Location', 'OpenSettings', 'Hidden'],
    },
    {
      name: 'PetAggregateView',
      module: PetAggregateViewModule as any,
      expectedTitle: 'Components/PetAggregateView',
      expectedStories: [
        'EmptyState',
        'ErrorState',
        'FreePlanLimitReached',
        'LoadingState',
        'MultiplePets',
        'PetWithActiveHealthAlert',
        'PetWithNoPhoto',
        'PremiumPlanMaxPets',
        'SinglePet',
      ],
    },
    {
      name: 'PetPhotoUploader',
      module: PetPhotoUploaderModule as any,
      expectedTitle: 'Components/PetPhotoUploader',
      expectedStories: ['Empty', 'WithPhoto'],
    },
    {
      name: 'PetSelectorBar',
      module: PetSelectorBarModule as any,
      expectedTitle: 'Components/PetSelectorBar',
      expectedStories: ['WithAddButton', 'WithoutAddButton', 'Dark'],
    },
    {
      name: 'QRCodeDisplay',
      module: QRCodeDisplayModule as any,
      expectedTitle: 'Components/QRCodeDisplay',
      expectedStories: ['Default'],
    },
    {
      name: 'ReminderSnoozeModal',
      module: ReminderSnoozeModalModule as any,
      expectedTitle: 'Components/ReminderSnoozeModal',
      expectedStories: ['Default'],
    },
    {
      name: 'RetryError',
      module: RetryErrorModule as any,
      expectedTitle: 'Components/RetryError',
      expectedStories: ['FirstFailure', 'SecondAttempt', 'MaxRetriesReached', 'Dark'],
    },
    {
      name: 'SecureView',
      module: SecureViewModule as any,
      expectedTitle: 'Components/SecureView',
      expectedStories: ['Default', 'WithSensitiveContent'],
    },
    {
      name: 'SOSButton',
      module: SOSButtonModule as any,
      expectedTitle: 'Components/SOSButton',
      expectedStories: ['Default', 'FullWidth'],
    },
    {
      name: 'ThemedStatusBar',
      module: ThemedStatusBarModule as any,
      expectedTitle: 'Components/ThemedStatusBar',
      expectedStories: ['Default'],
    },
    {
      name: 'UpdatePrompt',
      module: UpdatePromptModule as any,
      expectedTitle: 'Components/UpdatePrompt',
      expectedStories: ['OptionalUpdate', 'ForceUpdate'],
    },
    {
      name: 'VerificationBadge',
      module: VerificationBadgeModule as any,
      expectedTitle: 'Components/VerificationBadge',
      expectedStories: ['Verified', 'Failed', 'Pending', 'Unknown', 'AllStates'],
    },
    {
      name: 'VetVerifiedBadge',
      module: VetVerifiedBadgeModule as any,
      expectedTitle: 'Components/VetVerifiedBadge',
      expectedStories: ['Verified', 'Compact', 'LongAddress', 'Unverified', 'MultipleBadges'],
    },
    {
      name: 'WeightChart',
      module: WeightChartModule as any,
      expectedTitle: 'Components/WeightChart',
      expectedStories: [
        'AccessibleView',
        'SteadyGrowth',
        'WithAnnotations',
        'SinglePoint',
        'Empty',
        'NoVetRange',
        'TallChart',
        'LongTermData',
      ],
    },
  ];

  testCases.forEach(({ name, module: mod, expectedTitle, expectedStories }) => {
    describe(name, () => {
      const meta: any = mod.default;
      const exportedStoryKeys = Object.keys(mod).filter(
        (k) => k !== 'default' && k !== '__esModule',
      );

      it('has correct title', () => {
        expect(meta?.title).toBeDefined();
        expect(meta?.title).toMatchSnapshot(`${name}_title`);
      });

      it('has a component reference', () => {
        expect(meta?.component).toBeDefined();
      });

      it('exports expected story variants', () => {
        const keys = [...exportedStoryKeys].sort();
        const expected = [...expectedStories].sort();
        expect(keys).toEqual(expected);
      });

      const stories = exportedStoryKeys
        .filter((key) => typeof mod[key] === 'object' && mod[key] !== null)
        .map((key) => ({ name: key, story: mod[key] as Record<string, unknown> }));

      stories.forEach(({ name: storyName, story }) => {
        it(`${storyName} has valid args`, () => {
          const sanitized: Record<string, unknown> = {};
          if (story.args) {
            sanitized.args = {};
            for (const [key, val] of Object.entries(story.args as Record<string, unknown>)) {
              if (typeof val === 'function') {
                sanitized.args[key] = `[function ${(val as any).name || 'anonymous'}]`;
              } else if (val instanceof Error) {
                sanitized.args[key] = `[Error: ${val.message}]`;
              } else if (Array.isArray(val) && val.length > 5) {
                sanitized.args[key] = `[Array(${val.length})]`;
              } else if (
                (key.endsWith('Ms') || key.endsWith('At') || key.endsWith('Time')) &&
                typeof val === 'number'
              ) {
                sanitized.args[key] = '[timestamp]';
              } else {
                sanitized.args[key] = val;
              }
            }
          }
          if (story.render) {
            sanitized.hasRender = true;
          }
          expect(sanitized).toMatchSnapshot(`${name}_${storyName}`);
        });
      });
    });
  });
});
