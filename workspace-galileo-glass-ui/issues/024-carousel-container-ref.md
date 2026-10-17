# GlassCarousel never attaches the measurement ref and cannot advance its track

Suggested priority: **P1**  
Suggested labels: bug, carousel  
Reviewed version: 1.0.28 at `1474e6df7618ecadfd25ed91ce314da0e4edcb91`

## Problem and impact

The width-measurement effect reads containerRef, but the rendered CarouselContainer receives only the forwarded ref. containerRef remains null, containerWidthState remains zero, and bounds are permanently {min:0,max:0}. Every navigation/drag position is clamped to zero even while indicators advance.

## Reproduction

Render three 200px slides in a 300px-wide carousel. Click Next. The track remains translateX(0px). The review probe supplied a nonzero offsetWidth and reproduced the same result, showing this is not a JSDOM zero-width artifact.

## Expected behavior

Navigation moves the track using the measured container width while preserving the consumer's forwarded ref.

## Source references

- [src/components/Carousel/GlassCarousel.tsx:192](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Carousel/GlassCarousel.tsx#L192)
- [src/components/Carousel/GlassCarousel.tsx:227](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Carousel/GlassCarousel.tsx#L227)
- [src/components/Carousel/GlassCarousel.tsx:243](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Carousel/GlassCarousel.tsx#L243)
- [src/components/Carousel/GlassCarousel.tsx:371](https://github.com/auraoneai/galileo-glass-ui/blob/1474e6df7618ecadfd25ed91ce314da0e4edcb91/src/components/Carousel/GlassCarousel.tsx#L371)

## Acceptance criteria for one PR

- [ ] Attach the internal measurement ref and correctly merge it with the forwarded ref.
- [ ] Recompute bounds when the container changes size.
- [ ] Test Next/Previous movement and forwarded refs; include a browser resize case.

## Verification

Reproduced with the actual carousel and inertial hook; presentation controls were replaced with simple test controls.
