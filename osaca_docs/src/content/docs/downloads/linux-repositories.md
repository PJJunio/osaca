---
# SPDX-License-Identifier: AGPL-3.0-or-later
title: Linux repositories
description: How to add the apt, dnf, pacman and Flatpak repositories OSACA publishes.
---

OSACA publishes apt, dnf, pacman and Flatpak repositories, all signed with the key whose fingerprint is `09D01339EE128925F75E675C855C5BDE34D205D2`. You pick the channel with the entry file on apt and dnf, by package name on pacman and by app ID on Flatpak.

| Package manager | Pick stable with | Pick canary with |
| --- | --- | --- |
| apt | `osaca.sources` | `osaca-canary.sources` |
| dnf | `osaca.repo` | `osaca-canary.repo` |
| pacman | `osaca` | `osaca-canary` |
| Flatpak | `app.osaca.OSACA` | `app.osaca.OsacaCanary` |

## Debian and Ubuntu

```sh
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL -o /etc/apt/keyrings/osaca-archive-keyring.gpg \
  https://pkgs.osaca.example/keys/osaca-archive-keyring.gpg
sudo curl -fsSL -o /etc/apt/sources.list.d/osaca.sources \
  https://pkgs.osaca.example/deb/osaca.sources
sudo apt update && sudo apt install osaca
```

A `.deb` you downloaded only gets updates after you add the entry for its channel. For canary, add the canary entry and install `osaca-canary`.

```sh
sudo curl -fsSL -o /etc/apt/sources.list.d/osaca-canary.sources \
  https://pkgs.osaca.example/deb/osaca-canary.sources
sudo apt update && sudo apt install osaca-canary
```

## Fedora and RHEL

RHEL, Rocky, Alma and CentOS Stream need `sudo dnf install epel-release` first, because the package depends on `libXScrnSaver`.

```sh
sudo curl -fsSL -o /etc/yum.repos.d/osaca.repo \
  https://pkgs.osaca.example/rpm/osaca.repo
sudo dnf install osaca
```

dnf asks you to import the signing key on the first install, once for the repository and once for the package. Check that the fingerprint matches the one above both times.

For canary, add the canary entry and install `osaca-canary`.

```sh
sudo curl -fsSL -o /etc/yum.repos.d/osaca-canary.repo \
  https://pkgs.osaca.example/rpm/osaca-canary.repo
sudo dnf install osaca-canary
```

dnf keeps the repository metadata for six hours, so a new build can take up to six hours to show up. Run `sudo dnf --refresh upgrade` to check sooner.

## Arch Linux

Add the signing key to the pacman keyring once, or pacman refuses the repository with `unknown trust`.

```sh
sudo pacman-key --init
curl -fsSL -o /tmp/osaca-archive-keyring.asc \
  https://pkgs.osaca.example/keys/osaca-archive-keyring.asc
sudo pacman-key --add /tmp/osaca-archive-keyring.asc
sudo pacman-key --lsign-key 09D01339EE128925F75E675C855C5BDE34D205D2
```

Then add the repository and install `osaca` or `osaca-canary`.

```sh
sudo tee -a /etc/pacman.conf >/dev/null <<'REPO'

[osaca]
SigLevel = Required TrustedOnly
Server = https://pkgs.osaca.example/arch/$repo/os/$arch
REPO
sudo pacman -Syu osaca
```

## Flatpak

Stable is also on Flathub as `app.osaca.OSACA`, but canary is only in the OSACA repository. The reference file adds a remote called `osaca` and installs the app.

```sh
flatpak install https://pkgs.osaca.example/flatpak/osaca.flatpakref
```

For canary, use the canary reference file.

```sh
flatpak install https://pkgs.osaca.example/flatpak/osaca-canary.flatpakref
```
