import { describe, expect, it } from 'vitest';

import { extractImages } from '@/lib/pdf/docling';

describe('extractImages', () => {
  it('extracts images from document.images', () => {
    const result = {
      document: {
        images: [
          { data: 'base64_a', page: 1, format: 'png', filename: 'a.png' },
          { base64: 'base64_b', pageNumber: 3, type: 'image/jpeg' },
        ],
      },
    };

    const images = extractImages(result);

    expect(images).toHaveLength(2);
    expect(images[0]).toMatchObject({
      data: 'base64_a',
      pageNumber: 1,
      format: 'png',
      filename: 'a.png',
    });
    expect(images[1]).toMatchObject({
      data: 'base64_b',
      pageNumber: 3,
      format: 'jpg',
      filename: 'image_2.jpg',
    });
  });

  it('extracts data-uri images from json_content pictures', () => {
    const result = {
      document: {
        json_content: {
          pictures: [
            {
              image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA',
              prov: [{ page_no: 5 }],
              width: '120',
              height: 80,
              name: 'picture-from-json',
            },
          ],
        },
      },
    };

    const images = extractImages(result);

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      data: 'iVBORw0KGgoAAAANSUhEUgA',
      pageNumber: 5,
      format: 'png',
      filename: 'picture-from-json',
      width: 120,
      height: 80,
    });
  });

  it('returns empty array when no images are present', () => {
    const result = { document: { md_content: '# Hello' } };

    expect(extractImages(result)).toEqual([]);
    expect(extractImages(null)).toEqual([]);
  });
});
