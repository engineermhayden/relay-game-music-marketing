"""Optional feedback attachments: a screenshot from the photograph capture, and an Engine lab snapshot.

Both arrive only when the player ticks them, inside the CAPTCHA-protected submission, and
both are checked strictly: the screenshot is decoded and re-encoded by the server (which
drops metadata and anything that is not pixels), and the snapshot keeps only known fields.
"""
import base64
import binascii
import io
import math

from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

SCREENSHOT_FORMATS = {'data:image/png;base64': 'PNG', 'data:image/jpeg;base64': 'JPEG', 'data:image/webp;base64': 'WEBP'}
SCREENSHOT_MAX_BYTES = 1_500_000  # Decoded upload. The app sends a JPEG of a few hundred KB.
SCREENSHOT_MAX_SIDE = 4096
SCREENSHOT_STORED_SIDE = 1920
SCREENSHOT_QUALITY = 85
BAD_SCREENSHOT = 'The screenshot could not be read. Retake it, or send without it.'

TEXT, SHORT = 500, 80
# Field -> (type, maximum text length). Anything else in a snapshot is dropped.
SNAPSHOT = {
    'captured_at': (str, 40),
    'browser': {'user_agent': (str, TEXT), 'language': (str, 35), 'platform': (str, SHORT), 'viewport': (str, 40), 'pixel_ratio': (float, 0)},
    'renderer': {'backend': (str, SHORT), 'bloom': (str, SHORT), 'fog': (str, SHORT), 'shadow_map': (str, SHORT), 'grounding': (str, SHORT),
                 'particles': (str, SHORT), 'instanced_submissions': (int, 0), 'animated_assets': (int, 0)},
    'performance': {'fps': (int, 0), 'frame_ms': (int, 0), 'resolution_scale': (float, 0), 'draws': (int, 0), 'triangles': (int, 0)},
    'settings': {'quality': (str, 20), 'camera': (str, 20), 'material': (str, 20), 'bloom': (bool, 0), 'fog': (bool, 0),
                 'particles': (bool, 0), 'shadows': (bool, 0), 'lab': (bool, 0)},
    'scene': {'destination': (str, 40), 'mode': (str, 20)},
    'errors': ([str], TEXT), 'warnings': ([str], TEXT), 'limitations': ([str], TEXT),
}
SNAPSHOT_MAX_MESSAGES = 50
BAD_SNAPSHOT = 'The Engine lab snapshot could not be read. Capture it again, or send without it.'


def clean_screenshot(value):
    """JPEG bytes from a PNG/JPEG/WebP data URL, or None when no screenshot was attached."""
    if value is None or value == '':
        return None
    if not isinstance(value, str):
        raise ValidationError(BAD_SCREENSHOT)
    header, _, data = value.partition(',')
    expected = SCREENSHOT_FORMATS.get(header)
    if expected is None:
        raise ValidationError(BAD_SCREENSHOT)
    if len(data) > math.ceil(SCREENSHOT_MAX_BYTES / 3) * 4:
        raise ValidationError(f'The screenshot is too large (over {SCREENSHOT_MAX_BYTES / 1_000_000:g} MB). Send without it.')
    try:
        raw = base64.b64decode(data, validate=True)
        image = Image.open(io.BytesIO(raw))
        # Check the declared size before decoding any pixels (decompression bombs).
        if image.format != expected or not (16 <= image.width <= SCREENSHOT_MAX_SIDE and 16 <= image.height <= SCREENSHOT_MAX_SIDE):
            raise ValidationError(BAD_SCREENSHOT)
        image.load()
        image = image.convert('RGB')
    except (binascii.Error, ValueError, UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValidationError(BAD_SCREENSHOT)
    image.thumbnail((SCREENSHOT_STORED_SIDE, SCREENSHOT_STORED_SIDE))
    output = io.BytesIO()
    image.save(output, 'JPEG', quality=SCREENSHOT_QUALITY, optimize=True)
    return output.getvalue()


def _value(value, spec):
    kind, length = spec
    if kind is str:
        if not isinstance(value, str):
            raise ValidationError(BAD_SNAPSHOT)
        return value[:length]
    if kind is bool:
        if not isinstance(value, bool):
            raise ValidationError(BAD_SNAPSHOT)
        return value
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValidationError(BAD_SNAPSHOT)
    if kind is int:
        if value != int(value):
            raise ValidationError(BAD_SNAPSHOT)
        return int(value)
    return round(float(value), 3)


def clean_diagnostics(value):
    """The known fields of an Engine lab snapshot, or None when none was attached."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValidationError(BAD_SNAPSHOT)
    cleaned = {}
    for key, spec in SNAPSHOT.items():
        if key not in value or value[key] is None:
            continue
        item = value[key]
        if isinstance(spec, dict):
            if not isinstance(item, dict):
                raise ValidationError(BAD_SNAPSHOT)
            cleaned[key] = {field: _value(item[field], field_spec) for field, field_spec in spec.items() if item.get(field) is not None}
        elif isinstance(spec[0], list):
            if not isinstance(item, list) or not all(isinstance(message, str) for message in item):
                raise ValidationError(BAD_SNAPSHOT)
            cleaned[key] = [message[:spec[1]] for message in item[:SNAPSHOT_MAX_MESSAGES]]
        else:
            cleaned[key] = _value(item, spec)
    if not cleaned:
        raise ValidationError(BAD_SNAPSHOT)
    return cleaned
