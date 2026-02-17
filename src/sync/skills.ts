import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const OPENCODE_CONFIG_DIR = path.join(HOME, '.config', 'opencode');
const SKILLS_HUB = path.join(OPENCODE_CONFIG_DIR, 'skills');

const TARGET_DIRS = [
  path.join(HOME, '.claude', 'skills'),
  path.join(HOME, '.codex', 'skills'),
  path.join(HOME, '.gemini', 'skills'),
  path.join(HOME, '.config', 'github-copilot', 'skills'),
  path.join(HOME, '.cursor', 'skills'),
];

export async function ensureSkillSymlinks(): Promise<string[]> {
  const results: string[] = [];

  try {
    await fs.mkdir(SKILLS_HUB, { recursive: true });
  } catch (err: unknown) {
    throw new Error(`Failed to create skills hub at ${SKILLS_HUB}: ${String(err)}`);
  }

  try {
    const markerPath = path.join(SKILLS_HUB, '_CENTRAL_HUB_README.txt');
    try {
      await fs.access(markerPath);
    } catch {
      await fs.writeFile(
        markerPath,
        'This directory is the CENTRAL SKILLS HUB. All changes here reflect across Opencode, Claude, Codex, Gemini, Copilot, and Cursor.\nManaged by opencode-synced plugin.'
      );
      results.push(`Created marker file at ${markerPath}`);
    }
  } catch (err: unknown) {
    results.push(`Warning: Failed to create marker file: ${String(err)}`);
  }

  for (const targetPath of TARGET_DIRS) {
    try {
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });

      let stats: Stats;
      try {
        stats = await fs.lstat(targetPath);
      } catch {
        await fs.symlink(SKILLS_HUB, targetPath);
        results.push(`Created symlink: ${targetPath} -> ${SKILLS_HUB}`);
        continue;
      }

      if (stats.isSymbolicLink()) {
        const currentTarget = await fs.readlink(targetPath);
        if (currentTarget !== SKILLS_HUB) {
          await fs.unlink(targetPath);
          await fs.symlink(SKILLS_HUB, targetPath);
          results.push(`Fixed symlink: ${targetPath} -> ${SKILLS_HUB} (was ${currentTarget})`);
        }
      } else if (stats.isDirectory()) {
        // Absorb strategy: Move unique skills to Hub, then replace dir with link.
        const entries = await fs.readdir(targetPath);
        for (const entry of entries) {
          const srcPath = path.join(targetPath, entry);
          const destPath = path.join(SKILLS_HUB, entry);

          try {
            await fs.access(destPath);
            // Destination exists: Opencode version wins. Ignore local.
            // (We technically lose the local version here, effectively "preferring opencode")
          } catch {
            // Destination does not exist: Move local unique skill to Hub
            await fs.rename(srcPath, destPath);
            results.push(`Migrated unique skill '${entry}' from ${targetPath} to Hub`);
          }
        }

        // Backup the remnants (duplicates) just in case
        const backupPath = `${targetPath}.backup.${Date.now()}`;
        await fs.rename(targetPath, backupPath);

        await fs.symlink(SKILLS_HUB, targetPath);
        results.push(
          `Merged and linked: ${targetPath} -> ${SKILLS_HUB} (Duplicates backed up at ${backupPath})`
        );
      } else {
        await fs.unlink(targetPath);
        await fs.symlink(SKILLS_HUB, targetPath);
        results.push(`Replaced file with symlink: ${targetPath} -> ${SKILLS_HUB}`);
      }
    } catch (err: unknown) {
      results.push(`Error processing ${targetPath}: ${String(err)}`);
    }
  }

  return results;
}
