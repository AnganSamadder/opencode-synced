import fs from 'node:fs';
import path from 'node:path';

import type { SyncConfig } from './config.js';
import { expandHome, normalizePath } from './paths.js';

const PORTABLE_PREFIX = 'sync://plugins/';

const COMMON_PLUGIN_DIRS = [
  '~/Code/opencode-plugins',
  '~/code/opencode-plugins',
  '~/opencode-plugins',
  '~/Code/plugins',
  '~/code/plugins',
  '~/plugins',
];

export function inferPluginBaseDir(
  plugins: unknown[],
  homeDir: string,
  platform: NodeJS.Platform,
  existsSync: (path: string) => boolean = fs.existsSync
): string | null {
  const localPaths: string[] = [];

  for (const plugin of plugins) {
    if (typeof plugin !== 'string') continue;
    if (!isLocalPluginPath(plugin)) continue;
    localPaths.push(plugin);
  }

  if (localPaths.length === 0) return null;

  const expandedPaths = localPaths.map((p) => {
    if (p.startsWith('~')) {
      return expandHome(p, homeDir);
    }
    return p;
  });

  const normalizedPaths = expandedPaths.map((p) => normalizePath(p, homeDir, platform));

  const commonAncestor = findCommonAncestor(normalizedPaths, platform);
  if (!commonAncestor) return null;

  const expanded = expandHome(commonAncestor.replace(/^~/, homeDir), homeDir);
  if (existsSync(expanded)) {
    return expanded;
  }

  return commonAncestor.startsWith('~') ? expandHome(commonAncestor, homeDir) : commonAncestor;
}

function findCommonAncestor(paths: string[], platform: NodeJS.Platform): string | null {
  if (paths.length === 0) return null;
  if (paths.length === 1) {
    const parts = paths[0].split(path.sep);
    return parts.length > 1 ? parts.slice(0, -1).join(path.sep) : null;
  }

  const splitPaths = paths.map((p) => p.split(path.sep));

  const commonParts: string[] = [];
  for (let i = 0; i < splitPaths[0].length; i++) {
    const part = splitPaths[0][i];
    if (splitPaths.every((parts) => parts[i] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }

  if (commonParts.length === 0) return null;
  return commonParts.join(path.sep);
}

export function detectPluginBaseDir(
  homeDir: string,
  existsSync: (path: string) => boolean = fs.existsSync
): string | null {
  for (const dir of COMMON_PLUGIN_DIRS) {
    const expanded = expandHome(dir, homeDir);
    if (existsSync(expanded)) {
      return expanded;
    }
  }
  return null;
}

export function resolvePluginBaseDir(
  config: SyncConfig | null,
  homeDir: string,
  platform: NodeJS.Platform,
  plugins?: unknown[],
  existsSync?: (path: string) => boolean
): string | null {
  const inferredFromPlugins = plugins?.length
    ? inferPluginBaseDir(plugins, homeDir, platform, existsSync)
    : null;
  const detectedCommonDir = detectPluginBaseDir(homeDir, existsSync);
  const explicitConfig = resolveExplicitPluginBaseDir(config, homeDir, platform);

  return inferredFromPlugins ?? detectedCommonDir ?? explicitConfig;
}

function resolveExplicitPluginBaseDir(
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
