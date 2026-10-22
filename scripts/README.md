# README maintenance

Edit `README.md` directly. Projects, tool names, and certificates are native text. The images in `assets/` provide the header, link buttons, contribution skyline, and tool logos.

## Refresh the skyline

With Node.js 18 or newer:

```sh
node scripts/profile.mjs
```

This reads the public GitHub contribution calendar and updates three files: `assets/contributions.json`, `assets/contribution-skyline.svg`, and `assets/contribution-skyline-mobile.svg`. The local command needs no token or packages. The skyline shows the snapshot date.

The workflow in `.github/workflows/update-skyline.yml` runs every Monday at 04:23 UTC. It checks the script, fetches fresh data, and commits only those three files when they change. You can also run it from **Actions → Update contribution skyline → Run workflow**. It uses the built-in `GITHUB_TOKEN` with `contents: write`; no custom secret is needed. Scheduled runs begin once the workflow is on the repository's default branch. Branch rules must allow the bot to push updates.

To regenerate both images from the saved data without fetching GitHub:

```sh
node scripts/profile.mjs --offline
```

The snapshot covers 365 days ending on the refresh date in Africa/Cairo. Counts come from GitHub's calendar labels. An incomplete calendar causes the refresh to stop before writing files.

## Logos

`assets/logo-sources.json` records the source URLs. Each `tool-icon-*.svg` contains its own artwork, so no downloaded source copies are required. Logos are presented in grayscale, with wordmarks cropped where possible to avoid repeating the adjacent tool name.

QRadar, QRadar QNI, and IBM Resilient share the IBM mark. FortiSIEM and FortiSOAR share the Fortinet mark. Group-IB products share the Group-IB mark. Logos belong to their respective owners.
