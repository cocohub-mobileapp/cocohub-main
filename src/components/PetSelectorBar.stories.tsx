import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import type { ContextType } from 'react';
import { View } from 'react-native';

import PetSelectorBar from './PetSelectorBar';
import { ThemeStoryFrame } from './storybookThemeDecorator';
import { PetContext } from '../context/PetContext';
import type { Pet } from '../services/petService';

type MockPetContext = NonNullable<ContextType<typeof PetContext>>;

const mockPets: Pet[] = [
  {
    id: 'pet-coco',
    ownerId: 'owner-1',
    name: 'Coco',
    species: 'dog',
    breed: 'Labrador',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pet-miso',
    ownerId: 'owner-1',
    name: 'Miso',
    species: 'cat',
    breed: 'Tabby',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
] satisfies Pet[];

const mockPetContext = {
  pets: mockPets,
  activePet: mockPets[0],
  loading: false,
  error: null,
  setActivePet: action('setActivePet'),
  refreshPets: async () => undefined,
  getPetSettings: async () => ({
    notificationsEnabled: true,
    reminderLeadMinutes: 60,
    weightUnit: 'kg',
    notes: '',
  }),
  updatePetSettings: async () => undefined,
  totalPets: mockPets.length,
} satisfies MockPetContext;

/**
 * `PetSelectorBar` — A horizontal scrollable tab bar for switching between
 * pets in a multi-pet account.
 *
 * Reads pets from `PetContext` and highlights the active pet. Optionally
 * renders an "+ Add" chip when `onAddPet` is provided.
 *
 * ### Props
 * | Prop | Type | Default | Description |
 * |------|------|---------|-------------|
 * | `onAddPet` | `() => void` | — | Callback to navigate to the add-pet flow |
 *
 * ### Usage
 * ```tsx
 * // Place at the top of any screen that needs per-pet context
 * <PetSelectorBar onAddPet={() => navigation.navigate('AddPet')} />
 * ```
 *
 * > **Note:** This component requires `PetContext`. In Storybook you must wrap
 * > it with a mock `PetProvider` or the context will be empty.
 */
const meta: Meta<typeof PetSelectorBar> = {
  title: 'Components/PetSelectorBar',
  component: PetSelectorBar,
  decorators: [
    (Story) => (
      <ThemeStoryFrame mode="light">
        <PetContext.Provider value={mockPetContext}>
          <View>
            <Story />
          </View>
        </PetContext.Provider>
      </ThemeStoryFrame>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PetSelectorBar>;

/** With an "Add" button — requires PetContext in a real app. */
export const WithAddButton: Story = {
  args: {
    onAddPet: action('onAddPet'),
  },
};

/** Without the "Add" button. */
export const WithoutAddButton: Story = {
  args: {},
};

/** Dark mode preview of the selector chips. */
export const Dark: Story = {
  args: {
    onAddPet: action('dark-onAddPet'),
  },
  render: (args) => (
    <ThemeStoryFrame mode="dark">
      <PetContext.Provider value={mockPetContext}>
        <PetSelectorBar {...args} />
      </PetContext.Provider>
    </ThemeStoryFrame>
  ),
};
