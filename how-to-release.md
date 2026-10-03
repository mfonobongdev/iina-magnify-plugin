# How to release

IINA does not update a plugin from new commits. Check for Updates reads one file over HTTP, then, if the user accepts, installs the `.iinaplgz` attached to the latest GitHub release.

A push to `main` by itself shows "No update found."

## What IINA checks

Installed plugins with `ghRepo` and `ghVersion` in `Info.json` can be updated from Preferences, Plugins, Magnify, Check for Updates.

The check requests one of these URLs, using the `ghRepo` value (`mfonobongdev/iina-magnify-plugin`):

| IINA | URL |
|---|---|
| 1.3 and 1.4 | `https://raw.githubusercontent.com/mfonobongdev/iina-magnify-plugin/master/Info.json` |
| 1.5 | `https://raw.githubusercontent.com/mfonobongdev/iina-magnify-plugin/main/Info.json` |

The file must sit at the repository root. `Magnify.iinaplugin/Info.json` is not read. On 1.3 and 1.4 a 404 is reported as "No update found." It is not reported as a download error.

IINA compares the integer `ghVersion` in that file with the integer in the installed plugin. The update prompt appears only when the remote integer is strictly greater. The `version` string (`1.2.0`) is what the prompt displays. It is not what the comparison uses.

If the user accepts, IINA calls GitHub's latest-release API and downloads the first asset whose name ends in `.iinaplgz`. That package is what gets installed. The raw `Info.json` is only the signal.

## Two copies of Info.json

Keep these two files identical, including `version` and `ghVersion`:

- `Info.json` at the repo root. This is the file the update check reads.
- `Magnify.iinaplugin/Info.json`. This is the file inside the package, and the one the installed plugin reports next time.

`ghVersion` is an integer. Increment it by 1 for every release. `version` is `major.minor.patch`. Bump that to the version you want the prompt to show.

## Steps

1. Bump `version` and `ghVersion` in both `Info.json` files so they match.
2. Commit and push `main`.
3. Push that same commit to `master` as well. IINA 1.4 will not see a file that exists only on `main`.

```bash
git push origin HEAD
git push origin HEAD:master
```

4. Build a new zip from the plugin folder. Delete any previous zip first. `zip` updates an existing archive instead of replacing it.

```bash
rm -f /tmp/Magnify.iinaplgz
cd Magnify.iinaplugin
zip -X -r /tmp/Magnify.iinaplgz Info.json main.js overlay.html
unzip -l /tmp/Magnify.iinaplgz
```

The archive root must be the three files themselves, not a `Magnify.iinaplugin/` directory. `unzip -l` should look like this:

```text
Info.json
main.js
overlay.html
```

`unzip -p /tmp/Magnify.iinaplgz Info.json` must show the new `version` and `ghVersion`.

5. Publish that file as the latest GitHub release. The tag is `v` plus the `version` string. The asset name must end in `.iinaplgz`. A draft or prerelease is not "latest", so IINA will keep serving the previous package.

```bash
gh release create v1.2.0 /tmp/Magnify.iinaplgz --title "v1.2.0" --notes "$(cat <<'EOF'
Short description of what changed.

- One user-facing change
- Another user-facing change
EOF
)"
```

6. Confirm both raw URLs return the new `ghVersion` before asking anyone to click Check for Updates:

```bash
curl -fsSL https://raw.githubusercontent.com/mfonobongdev/iina-magnify-plugin/master/Info.json
curl -fsSL https://raw.githubusercontent.com/mfonobongdev/iina-magnify-plugin/main/Info.json
```

Then in IINA: Preferences, Plugins, Magnify, Check for Updates. The prompt should name the new `version`. Accepting it installs the release package.

## Failure modes

| What you see | Why |
|---|---|
| "No update found" after a push | Root `Info.json` is missing, `ghVersion` was not incremented, or `master` was not pushed. IINA 1.4 never looks at `main`. |
| Prompt appears, installed plugin is unchanged | Latest release is still the old `.iinaplgz`, or the new zip was built before the version bump. |
| Update offered again immediately after installing | The package's `ghVersion` is lower than the root file's `ghVersion`. The two `Info.json` files had drifted. |
| Zip contains stale files | `zip -r` was pointed at an existing `/tmp/Magnify.iinaplgz`. Delete it and rebuild. |
