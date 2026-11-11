// SPDX-License-Identifier: AGPL-3.0-or-later

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct MessageShredStatusResponse {
    #[serde(flatten)]
    pub data: serde_json::Value,
}
