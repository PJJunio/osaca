// SPDX-License-Identifier: AGPL-3.0-or-later

#include "native_shim_internal.h"

uint16_t osaca_gif_read_le16(const uint8_t *value) {
    assert(value != NULL);
    return (uint16_t)((uint16_t)value[0] | ((uint16_t)value[1] << 8));
}

int osaca_skip_gif_sub_blocks_checked(const uint8_t *bytes, size_t len,
                                       size_t *offset, size_t *block_count) {
    if (bytes == NULL || offset == NULL || block_count == NULL) {
        return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    }
    while (*offset < len) {
        if (*block_count >= OSACA_MAX_GIF_STRUCTURE_BLOCKS) {
            return OSACA_NATIVE_STATUS_WORK_LIMIT_EXCEEDED;
        }
        (*block_count)++;
        uint8_t block_len = bytes[*offset];
        *offset += 1;
        if (block_len == 0) return OSACA_NATIVE_STATUS_OK;
        if ((size_t)block_len > len - *offset) {
            return OSACA_NATIVE_STATUS_CODEC_FAILURE;
        }
        *offset += block_len;
    }
    return OSACA_NATIVE_STATUS_CODEC_FAILURE;
}

struct osaca_gif_validation_context {
    const uint8_t *bytes;
    size_t len;
    size_t offset;
    size_t image_count;
    size_t block_count;
    size_t canvas_pixels;
    size_t max_total_pixels;
    uint16_t canvas_width;
    uint16_t canvas_height;
    int max_frames;
};

static int osaca_gif_skip_color_table(
    struct osaca_gif_validation_context *context,
    uint8_t packed
) {
    assert(context != NULL);
    if ((packed & 0x80) == 0) return OSACA_NATIVE_STATUS_OK;
    size_t table_bytes = ((size_t)1 << ((packed & 0x07) + 1)) * 3u;
    if (table_bytes > context->len - context->offset) {
        return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    }
    context->offset += table_bytes;
    return OSACA_NATIVE_STATUS_OK;
}

static int osaca_gif_validation_context_init(
    struct osaca_gif_validation_context *context,
    const uint8_t *bytes,
    size_t len,
    int max_frames,
    size_t max_total_pixels
) {
    assert(context != NULL);
    if (bytes == NULL || len < 14 || max_frames <= 0 ||
        max_total_pixels == 0 ||
        (memcmp(bytes, "GIF87a", 6) != 0 &&
         memcmp(bytes, "GIF89a", 6) != 0)) {
        return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    }
    uint16_t canvas_width = osaca_gif_read_le16(bytes + 6);
    uint16_t canvas_height = osaca_gif_read_le16(bytes + 8);
    if (canvas_width == 0 || canvas_height == 0) {
        return OSACA_NATIVE_STATUS_INVALID_DIMENSIONS;
    }
    size_t canvas_pixels = (size_t)canvas_width * (size_t)canvas_height;
    if (canvas_pixels > max_total_pixels) {
        return OSACA_NATIVE_STATUS_WORK_LIMIT_EXCEEDED;
    }
    *context = (struct osaca_gif_validation_context) {
        .bytes = bytes,
        .len = len,
        .offset = 13,
        .canvas_pixels = canvas_pixels,
        .max_total_pixels = max_total_pixels,
        .canvas_width = canvas_width,
        .canvas_height = canvas_height,
        .max_frames = max_frames,
    };
    return osaca_gif_skip_color_table(context, bytes[10]);
}

static int osaca_gif_validate_image_block(
    struct osaca_gif_validation_context *context
) {
    assert(context != NULL);
    if (context->len - context->offset < 9) {
        return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    }
    const uint8_t *descriptor = context->bytes + context->offset;
    uint16_t left = osaca_gif_read_le16(descriptor);
    uint16_t top = osaca_gif_read_le16(descriptor + 2);
    uint16_t width = osaca_gif_read_le16(descriptor + 4);
    uint16_t height = osaca_gif_read_le16(descriptor + 6);
    uint8_t packed = descriptor[8];
    context->offset += 9;
    if (width == 0 || height == 0 ||
        (uint32_t)left + (uint32_t)width > context->canvas_width ||
        (uint32_t)top + (uint32_t)height > context->canvas_height) {
        return OSACA_NATIVE_STATUS_INVALID_DIMENSIONS;
    }
    int status = osaca_gif_skip_color_table(context, packed);
    if (status != OSACA_NATIVE_STATUS_OK) return status;
    if (context->offset >= context->len) {
        return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    }
    uint8_t minimum_code_size = context->bytes[context->offset++];
    if (minimum_code_size < 2 || minimum_code_size > 8) {
        return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    }
    status = osaca_skip_gif_sub_blocks_checked(
        context->bytes, context->len, &context->offset,
        &context->block_count);
    if (status != OSACA_NATIVE_STATUS_OK) return status;
    context->image_count++;
    if (context->image_count > (size_t)context->max_frames ||
        context->image_count >
            context->max_total_pixels / context->canvas_pixels) {
        return OSACA_NATIVE_STATUS_WORK_LIMIT_EXCEEDED;
    }
    return OSACA_NATIVE_STATUS_OK;
}

int osaca_validate_complete_gif(const uint8_t *bytes, size_t len,
                                 int max_frames, size_t max_total_pixels,
                                 int *out_expected_frames) {
    if (out_expected_frames == NULL) return OSACA_NATIVE_STATUS_CODEC_FAILURE;
    *out_expected_frames = 0;
    struct osaca_gif_validation_context context;
    int status = osaca_gif_validation_context_init(
        &context, bytes, len, max_frames, max_total_pixels);
    if (status != OSACA_NATIVE_STATUS_OK) return status;
    while (context.offset < context.len) {
        if (context.block_count >= OSACA_MAX_GIF_STRUCTURE_BLOCKS) {
            return OSACA_NATIVE_STATUS_WORK_LIMIT_EXCEEDED;
        }
        context.block_count++;
        uint8_t introducer = context.bytes[context.offset++];
        if (introducer == 0x3b) {
            if (context.image_count == 0 ||
                context.image_count > (size_t)INT_MAX) {
                return OSACA_NATIVE_STATUS_CODEC_FAILURE;
            }
            *out_expected_frames = (int)context.image_count;
            return OSACA_NATIVE_STATUS_OK;
        }
        if (introducer == 0x21) {
            if (context.offset >= context.len) {
                return OSACA_NATIVE_STATUS_CODEC_FAILURE;
            }
            context.offset++;
            status = osaca_skip_gif_sub_blocks_checked(
                context.bytes, context.len, &context.offset,
                &context.block_count);
            if (status != OSACA_NATIVE_STATUS_OK) return status;
            continue;
        }
        if (introducer != 0x2c) {
            return OSACA_NATIVE_STATUS_CODEC_FAILURE;
        }
        status = osaca_gif_validate_image_block(&context);
        if (status != OSACA_NATIVE_STATUS_OK) return status;
    }
    return OSACA_NATIVE_STATUS_CODEC_FAILURE;
}
