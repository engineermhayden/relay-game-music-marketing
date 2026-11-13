"""Self-hosted image CAPTCHA for sign-up, sign-in, password-reset and feedback requests.

No third-party service: images are drawn with Pillow (already a dependency) and
challenges live in the Django cache (Redis). Each challenge works once: any
answer, right or wrong, consumes it, so the client shows a new image after
every attempt, and a page refresh always starts with a new one.

Only a keyed hash of each answer is stored, never the answer itself.
"""
import base64
import io
import math
import random
import secrets

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import constant_time_compare, salted_hmac
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from rest_framework.exceptions import ValidationError

# No lookalikes: 0/O/Q and 1/I/L are left out. Answers ignore case and spaces.
ALPHABET = 'ABCDEFGHJKMNPRSTUVWXYZ23456789'
LENGTH = 5
WIDTH, HEIGHT = 240, 80
# Accepted only when ACCOUNT_CAPTCHA_TEST_MODE is on (end-to-end tests; refused with secure cookies).
TEST_ANSWER = 'PASSED'
_rng = random.SystemRandom()
BACKGROUNDS = [(13, 27, 28), (18, 34, 30), (16, 30, 34), (22, 36, 28)]
INKS = [(217, 247, 176), (185, 243, 107), (159, 227, 208), (240, 230, 200), (207, 227, 198), (244, 196, 150)]


def random_text():
    return ''.join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def normalize(answer):
    return ''.join(answer.split()).upper()


def _key(challenge_id):
    return f'accounts:captcha:{challenge_id}'


def _digest(challenge_id, answer):
    return salted_hmac('accounts.captcha', f'{challenge_id}:{normalize(answer)}', algorithm='sha256').hexdigest()


def new_challenge():
    """Create a challenge and return (id, PNG data URL)."""
    challenge_id, text = secrets.token_urlsafe(18), random_text()
    cache.set(_key(challenge_id), _digest(challenge_id, text), settings.ACCOUNT_CAPTCHA_TTL)
    return challenge_id, 'data:image/png;base64,' + base64.b64encode(render(text)).decode()


def check(challenge_id, answer):
    """Consume a challenge and report whether the answer matched. Never reusable."""
    if not isinstance(challenge_id, str) or not isinstance(answer, str) or not 0 < len(challenge_id) <= 64 or len(answer) > 16:
        return False
    expected = cache.get(_key(challenge_id))
    # Delete before comparing; if a concurrent request already deleted it, that request won.
    if expected is None or not cache.delete(_key(challenge_id)):
        return False
    if settings.ACCOUNT_CAPTCHA_TEST_MODE and normalize(answer) == TEST_ANSWER:
        return True
    return constant_time_compare(expected, _digest(challenge_id, answer))


def require_captcha(request):
    """Check (and always consume) the request's CAPTCHA before any other work, including password hashing."""
    answer = request.data.get('captcha_answer')
    if not isinstance(answer, str) or not answer.strip():
        check(request.data.get('captcha_id'), '')  # Still spend the challenge.
        raise ValidationError('Type the characters shown in the image.')
    if not check(request.data.get('captcha_id'), answer):
        raise ValidationError('The characters did not match the image, or it expired. Try the new image.')


def _glyph(character, ink):
    size = _rng.randint(46, 54)
    font = ImageFont.load_default(size=size)  # Pillow's bundled scalable font; no font files to ship.
    layer = Image.new('RGBA', (size * 2, size * 2), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((size // 2, size // 3), character, font=font, fill=ink, stroke_width=1, stroke_fill=ink)
    layer = layer.rotate(_rng.uniform(-22, 22), resample=Image.Resampling.BICUBIC)
    # Shear each character differently so no single transform undoes them all.
    shear = _rng.uniform(-0.22, 0.22)
    layer = layer.transform(layer.size, Image.Transform.AFFINE, (1, shear, -shear * layer.height / 2, 0, 1, 0), resample=Image.Resampling.BICUBIC)
    return layer.crop(layer.getbbox())


def _noise_curve(draw, ink, width):
    """A wavy line across the text, in text colours so it cannot be filtered out by colour."""
    amplitude, period, phase = _rng.uniform(6, 16), _rng.uniform(60, 160), _rng.uniform(0, math.tau)
    base = _rng.uniform(HEIGHT * 0.3, HEIGHT * 0.7)
    points = [(x, base + amplitude * math.sin(math.tau * x / period + phase)) for x in range(-4, WIDTH + 8, 4)]
    draw.line(points, fill=ink, width=width, joint='curve')


def render(text):
    background = Image.new('RGBA', (WIDTH, HEIGHT), _rng.choice(BACKGROUNDS) + (255,))
    draw = ImageDraw.Draw(background)
    for _ in range(140):  # Speckle.
        x, y = _rng.randrange(WIDTH), _rng.randrange(HEIGHT)
        draw.point((x, y), fill=_rng.choice(INKS) + (_rng.randint(50, 140),))
    for _ in range(2):
        _noise_curve(draw, _rng.choice(INKS) + (90,), 1)

    glyphs = [_glyph(character, _rng.choice(INKS) + (255,)) for character in text]
    overlaps = [_rng.randint(-5, 1) for _ in glyphs]
    total = sum(glyph.width for glyph in glyphs) + sum(overlaps[1:])
    letters = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    x = max(4, (WIDTH - total) // 2 + _rng.randint(-10, 10))
    for glyph, overlap in zip(glyphs, overlaps):
        x += overlap
        letters.alpha_composite(glyph, (max(0, min(x, WIDTH - glyph.width)), max(0, min((HEIGHT - glyph.height) // 2 + _rng.randint(-8, 8), HEIGHT - glyph.height))))
        x += glyph.width

    # Wave the whole word vertically, two pixels at a time.
    warped = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    amplitude, period, phase = _rng.uniform(3, 6), _rng.uniform(50, 90), _rng.uniform(0, math.tau)
    for column in range(0, WIDTH, 2):
        strip = letters.crop((column, 0, column + 2, HEIGHT))
        warped.paste(strip, (column, round(amplitude * math.sin(math.tau * column / period + phase))), strip)

    background.alpha_composite(warped)
    draw = ImageDraw.Draw(background)
    _noise_curve(draw, _rng.choice(INKS) + (220,), 2)  # One strike through the letters.
    image = background.convert('RGB').filter(ImageFilter.SMOOTH)
    output = io.BytesIO()
    image.save(output, 'PNG', optimize=True)
    return output.getvalue()
