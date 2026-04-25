#!/usr/bin/env python3
"""Generate catalog.yaml from the plugins directory structure.

Expected layout:
  plugins/{domain}/{category}/{plugin}/plugin.yaml

Produces a catalog.yaml at the repository root with the form:
  catalog: <repo_url>
  plugins:
    - domain:
        code: <domain>
        categories:
          - code: <category>
            plugins:
              - code: <plugin>
                name: <displayName from plugin.yaml>
                repoUrl: <repoUrl from plugin.yaml>
"""

import os
import sys

import yaml


def load_plugin_meta(plugin_yaml_path):
    try:
        with open(plugin_yaml_path, "r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError) as exc:
        print(f"Warning: could not parse {plugin_yaml_path}: {exc}", file=sys.stderr)
        return {}


def generate_catalog(plugins_dir, repo_url):
    catalog = {
        "catalog": repo_url,
        "plugins": [],
    }

    if not os.path.isdir(plugins_dir):
        return catalog

    for domain_name in sorted(os.listdir(plugins_dir)):
        domain_path = os.path.join(plugins_dir, domain_name)
        if not os.path.isdir(domain_path):
            continue

        categories = []

        for category_name in sorted(os.listdir(domain_path)):
            category_path = os.path.join(domain_path, category_name)
            if not os.path.isdir(category_path):
                continue

            plugins = []

            for plugin_name in sorted(os.listdir(category_path)):
                plugin_path = os.path.join(category_path, plugin_name)
                if not os.path.isdir(plugin_path):
                    continue

                plugin_yaml_path = os.path.join(plugin_path, "plugin.yaml")
                if not os.path.isfile(plugin_yaml_path):
                    continue

                meta = load_plugin_meta(plugin_yaml_path)
                plugins.append(
                    {
                        "code": plugin_name,
                        "name": meta.get("displayName", ""),
                        "repoUrl": meta.get("repoUrl", ""),
                    }
                )

            if plugins:
                categories.append({"code": category_name, "plugins": plugins})

        if categories:
            catalog["plugins"].append(
                {"domain": {"code": domain_name, "categories": categories}}
            )

    return catalog


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    plugins_dir = os.path.join(repo_root, "plugins")

    repo_url = os.environ.get("CATALOG_REPO_URL", "")
    if not repo_url:
        print("Warning: CATALOG_REPO_URL environment variable is not set.", file=sys.stderr)

    catalog = generate_catalog(plugins_dir, repo_url)

    output_path = os.path.join(repo_root, "catalog.yaml")
    with open(output_path, "w", encoding="utf-8") as fh:
        yaml.dump(catalog, fh, allow_unicode=True, sort_keys=False, default_flow_style=False)

    print(f"catalog.yaml written to {output_path}")


if __name__ == "__main__":
    main()
