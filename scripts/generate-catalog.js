#!/usr/bin/env node
/**
 * Generate catalog.yaml from the plugins directory structure.
 *
 * Expected layout:
 *   plugins/{domain}/{category}/{plugin}/plugin.yaml
 *
 * Produces a catalog.yaml at the repository root:
 *   catalog: <repo_url>
 *   plugins:
 *     - domain:
 *         code: <domain>
 *         categories:
 *           - code: <category>
 *             plugins:
 *               - code: <plugin>
 *                 name: <displayName from plugin.yaml>
 *                 repoUrl: <repoUrl from plugin.yaml>
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal YAML parser (key: value only, no arrays needed for plugin.yaml)
// ---------------------------------------------------------------------------
function parseSimpleYaml(text) {
  const result = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Minimal YAML serialiser for the catalog structure
// ---------------------------------------------------------------------------
function serializeCatalog(catalog) {
  const lines = [];
  lines.push(`catalog: ${catalog.catalog}`);
  lines.push('plugins:');
  if (!catalog.plugins.length) {
    lines.push('  []');
  } else {
    for (const domainEntry of catalog.plugins) {
      const { code: domainCode, categories } = domainEntry.domain;
      lines.push(`  - domain:`);
      lines.push(`      code: ${domainCode}`);
      lines.push(`      categories:`);
      for (const cat of categories) {
        lines.push(`        - code: ${cat.code}`);
        lines.push(`          plugins:`);
        for (const plug of cat.plugins) {
          lines.push(`            - code: ${plug.code}`);
          lines.push(`              name: ${plug.name}`);
          lines.push(`              repoUrl: ${plug.repoUrl}`);
        }
      }
    }
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------
function subdirs(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(name => fs.statSync(path.join(dir, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

function generateCatalog(pluginsDir, repoUrl) {
  const catalog = { catalog: repoUrl, plugins: [] };

  for (const domainName of subdirs(pluginsDir)) {
    const domainPath = path.join(pluginsDir, domainName);
    const categories = [];

    for (const categoryName of subdirs(domainPath)) {
      const categoryPath = path.join(domainPath, categoryName);
      const plugins = [];

      for (const pluginName of subdirs(categoryPath)) {
        const pluginYamlPath = path.join(categoryPath, pluginName, 'plugin.yaml');
        if (!fs.existsSync(pluginYamlPath)) continue;

        let meta = {};
        try {
          meta = parseSimpleYaml(fs.readFileSync(pluginYamlPath, 'utf8'));
        } catch (err) {
          process.stderr.write(`Warning: could not read ${pluginYamlPath}: ${err.message}\n`);
        }

        plugins.push({
          code: pluginName,
          name: meta.displayName || '',
          repoUrl: meta.repoUrl || '',
        });
      }

      if (plugins.length) {
        categories.push({ code: categoryName, plugins });
      }
    }

    if (categories.length) {
      catalog.plugins.push({ domain: { code: domainName, categories } });
    }
  }

  return catalog;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(__dirname, '..');
const pluginsDir = path.join(repoRoot, 'plugins');
const repoUrl = process.env.CATALOG_REPO_URL || '';

if (!repoUrl) {
  process.stderr.write('Warning: CATALOG_REPO_URL environment variable is not set.\n');
}

const catalog = generateCatalog(pluginsDir, repoUrl);
const outputPath = path.join(repoRoot, 'catalog.yaml');
fs.writeFileSync(outputPath, serializeCatalog(catalog), 'utf8');
console.log(`catalog.yaml written to ${outputPath}`);
