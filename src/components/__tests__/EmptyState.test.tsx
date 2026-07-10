import React from 'react';

import { EmptyState } from '../EmptyState';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: jest.fn(() => null),
}));

describe('EmptyState', () => {
  it('exports the EmptyState component', () => {
    expect(EmptyState).toBeDefined();
    expect(typeof EmptyState).toBe('function');
  });

  it('accepts primary and secondary calls to action', () => {
    const onPress = jest.fn();
    const onSecondaryPress = jest.fn();

    const element = React.createElement(EmptyState, {
      icon: 'paw',
      title: 'Welcome to Cocohub',
      description: 'Add your first pet to get started.',
      buttonText: 'Add your first pet',
      onPress,
      buttonAccessibilityLabel: 'Add your first pet',
      secondaryText: 'Browse adoptable pets',
      onSecondaryPress,
      secondaryAccessibilityLabel: 'Browse adoptable pets',
      testID: 'pets-empty-state',
    });

    expect(element.props.title).toBe('Welcome to Cocohub');
    expect(element.props.buttonText).toBe('Add your first pet');
    expect(element.props.onPress).toBe(onPress);
    expect(element.props.secondaryText).toBe('Browse adoptable pets');
    expect(element.props.onSecondaryPress).toBe(onSecondaryPress);
    expect(element.props.testID).toBe('pets-empty-state');
  });
});
