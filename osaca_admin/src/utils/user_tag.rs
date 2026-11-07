// SPDX-License-Identifier: AGPL-3.0-or-later

pub fn shows_discriminator(discriminator: &str, is_bot: bool) -> bool {
    is_bot || discriminator.trim().parse::<u16>() != Ok(0)
}

pub fn user_tag(username: &str, discriminator: &str, is_bot: bool) -> String {
    if shows_discriminator(discriminator, is_bot) {
        format!("{username}#{discriminator}")
    } else {
        username.to_owned()
    }
}

pub fn display_with_tag(
    global_name: Option<&str>,
    username: &str,
    discriminator: &str,
    is_bot: bool,
) -> String {
    let tag = user_tag(username, discriminator, is_bot);
    match global_name.filter(|name| !name.trim().is_empty()) {
        Some(name) => format!("{name} ({tag})"),
        None => tag,
    }
}
