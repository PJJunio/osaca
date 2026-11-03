// SPDX-License-Identifier: AGPL-3.0-or-later

pub use osaca_sample_pool::PCM_SLOT_SAMPLES_MAX;
pub type PcmFramePool = osaca_sample_pool::SamplePool<f32, false>;
pub type PooledPcmFrame = osaca_sample_pool::PooledSamples<f32, false>;
pub use osaca_sample_pool::PcmPoolError;
