/* eslint-disable @typescript-eslint/no-require-imports */

const { withMainActivity } = require('@expo/config-plugins');

const KOTLIN_IMPORTS = [
  'import android.os.Build',
  'import android.os.Bundle',
  'import android.view.WindowManager',
];

const JAVA_IMPORTS = [
  'import android.os.Build;',
  'import android.os.Bundle;',
  'import android.view.WindowManager;',
];

const KOTLIN_ON_CREATE = `
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableSosLockScreenAccess()
  }
`;

const KOTLIN_HELPER = `
  private fun enableSosLockScreenAccess() {
    // Keep the emergency surface interactive if Android locks while the app is foregrounded.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
  }
`;

const JAVA_ON_CREATE = `
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    enableSosLockScreenAccess();
  }
`;

const JAVA_HELPER = `
  private void enableSosLockScreenAccess() {
    // Keep the emergency surface interactive if Android locks while the app is foregrounded.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else {
      getWindow().addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      );
    }
  }
`;

function addMissingImports(contents, imports) {
  const missing = imports.filter((line) => !contents.includes(line));
  if (missing.length === 0) return contents;

  const packageMatch = contents.match(/^package\s+[^\n]+\n?/m);
  const insertAt = packageMatch ? packageMatch.index + packageMatch[0].length : 0;
  return `${contents.slice(0, insertAt)}${missing.join('\n')}\n${contents.slice(insertAt)}`;
}

function insertBeforeFinalClassBrace(contents, addition) {
  const index = contents.lastIndexOf('\n}');
  if (index === -1) return `${contents.trimEnd()}\n${addition}`;
  return `${contents.slice(0, index)}${addition}${contents.slice(index)}`;
}

function addKotlinLockScreenAccess(contents) {
  let next = addMissingImports(contents, KOTLIN_IMPORTS);

  if (!/^\s+enableSosLockScreenAccess\(\)$/m.test(next)) {
    if (/override\s+fun\s+onCreate\s*\(/.test(next)) {
      next = next.replace(/(super\.onCreate\([^)]*\))/, '$1\n    enableSosLockScreenAccess()');
    } else {
      next = insertBeforeFinalClassBrace(next, KOTLIN_ON_CREATE);
    }
  }

  if (!next.includes('private fun enableSosLockScreenAccess')) {
    next = insertBeforeFinalClassBrace(next, KOTLIN_HELPER);
  }

  return next;
}

function addJavaLockScreenAccess(contents) {
  let next = addMissingImports(contents, JAVA_IMPORTS);

  if (!/^\s+enableSosLockScreenAccess\(\);$/m.test(next)) {
    if (/protected\s+void\s+onCreate\s*\(/.test(next)) {
      next = next.replace(/(super\.onCreate\([^)]*\);)/, '$1\n    enableSosLockScreenAccess();');
    } else {
      next = insertBeforeFinalClassBrace(next, JAVA_ON_CREATE);
    }
  }

  if (!next.includes('private void enableSosLockScreenAccess')) {
    next = insertBeforeFinalClassBrace(next, JAVA_HELPER);
  }

  return next;
}

function addSosLockScreenAccess(contents, language) {
  if (!contents) return contents;
  const isKotlin =
    language === 'kt' || language === 'kotlin' || contents.includes(': ReactActivity');
  return isKotlin ? addKotlinLockScreenAccess(contents) : addJavaLockScreenAccess(contents);
}

const withSosLockScreenPlugin = (config) =>
  withMainActivity(config, (config) => {
    config.modResults.contents = addSosLockScreenAccess(
      config.modResults.contents,
      config.modResults.language,
    );
    return config;
  });

module.exports = withSosLockScreenPlugin;
module.exports._internal = { addSosLockScreenAccess };
