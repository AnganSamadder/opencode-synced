import { describe, expect, it } from 'vitest';
import type { SyncConfig } from './config.js';
import {
  isLocalPluginPath,
  isPortablePluginPath,
  pluginPathToPortable,
  portableToPluginPath,
  resolvePluginBaseDir,
  transformPluginsForLocal,
  transformPluginsForRepo,
} from './plugin-path.js';

describe('isLocalPluginPath', () => {
  it('returns true for absolute paths', () => {
    expect(isLocalPluginPath('/home/user/plugins/my-plugin')).toBe(true);
    expect(isLocalPluginPath('C:/Users/plugins/my-plugin')).toBe(true);
  });

  it('returns true for tilde paths', () => {
    expect(isLocalPluginPath('~/plugins/my-plugin')).toBe(true);
  });

  it('returns false for npm packages', () => {
    expect(isLocalPluginPath('@scope/my-plugin')).toBe(false);
    expect(isLocalPluginPath('my-npm-plugin')).toBe(false);
  });

  it('returns false for portable paths', () => {
    expect(isLocalPluginPath('sync://plugins/my-plugin')).toBe(false);
  });
});

describe('isPortablePluginPath', () => {
  it('returns true for sync://plugins paths', () => {
    expect(isPortablePluginPath('sync://plugins/my-plugin')).toBe(true);
    expect(isPortablePluginPath('sync://plugins/openkilo')).toBe(true);
  });

  it('returns false for other paths', () => {
    expect(isPortablePluginPath('/home/user/plugins/my-plugin')).toBe(false);
    expect(isPortablePluginPath('~/plugins/my-plugin')).toBe(false);
    expect(isPortablePluginPath('@scope/my-plugin')).toBe(false);
  });
});

describe('pluginPathToPortable', () => {
  it('converts local path to portable', () => {
    const result = pluginPathToPortable(
      '/home/angan/code/plugins/openkilo',
      '/home/angan/code/plugins',
      'linux'
    );
    expect(result).toBe('sync://plugins/openkilo');
  });

  it('converts nested plugin path', () => {
    const result = pluginPathToPortable(
      '/home/angan/code/plugins/opencode-synced/src',
      '/home/angan/code/plugins',
      'linux'
    );
    expect(result).toBe('sync://plugins/opencode-synced');
  });

  it('returns null for path outside base dir', () => {
    const result = pluginPathToPortable(
      '/other/location/plugin',
      '/home/angan/code/plugins',
      'linux'
    );
    expect(result).toBeNull();
  });

  it('returns null for npm packages', () => {
    const result = pluginPathToPortable('@scope/plugin', '/plugins', 'linux');
    expect(result).toBeNull();
  });

  it('handles macOS paths', () => {
    const result = pluginPathToPortable(
      '/Users/angansamadder/Code/opencode-plugins/openkilo',
      '/Users/angansamadder/Code/opencode-plugins',
      'darwin'
    );
    expect(result).toBe('sync://plugins/openkilo');
  });
});

describe('portableToPluginPath', () => {
  it('converts portable to local path', () => {
    const result = portableToPluginPath('sync://plugins/openkilo', '/home/ongan/code/plugins');
    expect(result).toBe('/home/ongan/code/plugins/openkilo');
  });

  it('returns null for non-portable paths', () => {
    const result = portableToPluginPath('/absolute/path', '/plugins');
    expect(result).toBeNull();
  });

  it('handles macOS paths', () => {
    const result = portableToPluginPath(
      'sync://plugins/openkilo',
      '/Users/angansamadder/Code/opencode-plugins'
    );
    expect(result).toBe('/Users/angansamadder/Code/opencode-plugins/openkilo');
  });
});

describe('resolvePluginBaseDir', () => {
  it('returns null when config is null', () => {
    expect(resolvePluginBaseDir(null, '/home/user', 'linux')).toBeNull();
  });

  it('returns null when pluginBaseDir is not set', () => {
    expect(resolvePluginBaseDir({}, '/home/user', 'linux')).toBeNull();
  });

  it('resolves string base dir with tilde expansion', () => {
    const config: SyncConfig = { pluginBaseDir: '~/plugins' };
    const result = resolvePluginBaseDir(config, '/home/user', 'linux');
    expect(result).toBe('/home/user/plugins');
  });

  it('resolves per-platform base dir', () => {
    const config: SyncConfig = {
      pluginBaseDir: {
        darwin: '/Users/angansamadder/Code/opencode-plugins',
        linux: '/home/angan/code/opencode-plugins',
        win32: 'C:\\Users\\angan\\Code\\opencode-plugins',
      },
    };

    expect(resolvePluginBaseDir(config, '/home/user', 'darwin')).toBe(
      '/Users/angansamadder/Code/opencode-plugins'
    );
    expect(resolvePluginBaseDir(config, '/home/user', 'linux')).toBe(
      '/home/angan/code/opencode-plugins'
    );
    expect(resolvePluginBaseDir(config, 'C:\\Users', 'win32')).toBe(
      'C:\\Users\\angan\\Code\\opencode-plugins'
    );
  });

  it('returns null when platform not in per-platform config', () => {
    const config: SyncConfig = {
      pluginBaseDir: {
        darwin: '/Users/test/plugins',
        linux: '/home/test/plugins',
      },
    };
    expect(resolvePluginBaseDir(config, '/home/user', 'win32')).toBeNull();
  });
});

describe('transformPluginsForRepo', () => {
  it('transforms local plugin paths to portable', () => {
    const plugins = [
      'opencode-antigravity-auth@latest',
      '/home/angan/code/plugins/openkilo',
      '@angan/opencode-synced',
      '/home/angan/code/plugins/opentmux',
      'oh-my-opencode',
    ];

    const result = transformPluginsForRepo(plugins, '/home/angan/code/plugins', 'linux');

    expect(result).toEqual([
      'opencode-antigravity-auth@latest',
      'sync://plugins/openkilo',
      '@angan/opencode-synced',
      'sync://plugins/opentmux',
      'oh-my-opencode',
    ]);
  });

  it('returns plugins unchanged when base dir is null', () => {
    const plugins = ['/home/ongan/code/plugins/openkilo'];
    const result = transformPluginsForRepo(plugins, null, 'linux');
    expect(result).toEqual(plugins);
  });

  it('preserves non-string entries', () => {
    const plugins = [{ name: 'complex-plugin' }, '/plugins/simple'];
    const result = transformPluginsForRepo(plugins, '/plugins', 'linux');
    expect(result[0]).toEqual({ name: 'complex-plugin' });
    expect(result[1]).toBe('sync://plugins/simple');
  });
});

describe('transformPluginsForLocal', () => {
  it('transforms portable paths to local paths', () => {
    const plugins = [
      'opencode-antigravity-auth@latest',
      'sync://plugins/openkilo',
      '@angan/opencode-synced',
      'sync://plugins/opentmux',
      'oh-my-opencode',
    ];

    const result = transformPluginsForLocal(plugins, '/Users/angansamadder/Code/opencode-plugins');

    expect(result).toEqual([
      'opencode-antigravity-auth@latest',
      '/Users/angansamadder/Code/opencode-plugins/openkilo',
      '@angan/opencode-synced',
      '/Users/angansamadder/Code/opencode-plugins/opentmux',
      'oh-my-opencode',
    ]);
  });

  it('returns plugins unchanged when base dir is null', () => {
    const plugins = ['sync://plugins/openkilo'];
    const result = transformPluginsForLocal(plugins, null);
    expect(result).toEqual(plugins);
  });

  it('preserves paths that are not portable', () => {
    const plugins = ['/existing/absolute/path', '@npm/package'];
    const result = transformPluginsForLocal(plugins, '/plugins');
    expect(result).toEqual(['/existing/absolute/path', '@npm/package']);
  });
});
