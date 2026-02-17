import path from 'node:path';
import type { SyncConfig } from './config.js';
import { expandHome, normalizePath } from './paths.js';

const PORTABLE_PREFIX = 'sync://plugins/';

export function resolvePluginBaseDir(
  config: SyncConfig | null,
  homeDir: string,
  platform: NodeJS.Platform
): string | null {
  if (!config?.pluginBaseDir) return null;

  const baseDir = config.pluginBaseDir;

  if (typeof baseDir === 'string') {
    return expandHome(baseDir, homeDir);
  }

  const platformDir = baseDir[platform];
  if (!platformDir) return null;

  return expandHome(platformDir, homeDir);
}

export function pluginPathToPortable(
  pluginPath: string,
  pluginBaseDir: string,
  platform: NodeJS.Platform
): string | null {
  if (!isLocalPluginPath(pluginPath)) return null;

  const normalizedPluginPath = normalizePath(pluginPath, '', platform);
  const normalizedBaseDir = normalizePath(pluginBaseDir, '', platform);

  if (!normalizedPluginPath.startsWith(normalizedBaseDir)) return null;

  const relativePath = path.relative(normalizedBaseDir, normalizedPluginPath);
  if (!relativePath || relativePath.startsWith('..')) return null;

  const pluginName = relativePath.split(path.sep)[0];
  if (!pluginName) return null;

  return `${PORTABLE_PREFIX}${pluginName}`;
}

export function portableToPluginPath(portablePath: string, pluginBaseDir: string): string | null {
  if (!portablePath.startsWith(PORTABLE_PREFIX)) return null;

  const pluginName = portablePath.slice(PORTABLE_PREFIX.length);
  if (!pluginName) return null;

  return path.join(pluginBaseDir, pluginName);
}

export function isLocalPluginPath(value: string): boolean {
  if (value.startsWith('sync://')) return false;
  if (value.startsWith('@')) return false;
  if (!value.includes('/') && !value.includes('\\')) return false;
  if (path.isAbsolute(value)) return true;
  if (value.startsWith('~')) return true;
  if (/^[A-Za-z]:[\\/]/.test(value)) return true;
  return false;
}

export function isPortablePluginPath(value: string): boolean {
  return value.startsWith(PORTABLE_PREFIX);
}

export function transformPluginsForRepo(
  plugins: unknown[],
  pluginBaseDir: string | null,
  platform: NodeJS.Platform
): unknown[] {
  if (!pluginBaseDir) return plugins;

  return plugins.map((plugin) => {
    if (typeof plugin !== 'string') return plugin;
    const portable = pluginPathToPortable(plugin, pluginBaseDir, platform);
    return portable ?? plugin;
  });
}

export function transformPluginsForLocal(
  plugins: unknown[],
  pluginBaseDir: string | null
): unknown[] {
  if (!pluginBaseDir) return plugins;

  return plugins.map((plugin) => {
    if (typeof plugin !== 'string') return plugin;
    const localPath = portableToPluginPath(plugin, pluginBaseDir);
    return localPath ?? plugin;
  });
}
