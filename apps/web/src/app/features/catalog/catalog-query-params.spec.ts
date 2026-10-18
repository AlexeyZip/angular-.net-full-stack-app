import { convertToParamMap } from '@angular/router';
import { DEFAULT_CATALOG_FILTERS } from '@shop/state/contracts';
import { filtersFromParams, filtersToParams } from './catalog-query-params';

describe('catalog query params', () => {
  it('parses a shared link into filters', () => {
    const filters = filtersFromParams(
      convertToParamMap({ search: ' lamp ', category: 'home', minPrice: '10', maxPrice: '50', inStock: 'true', sort: 'PriceAsc', page: '3' }),
    );

    expect(filters).toEqual({
      ...DEFAULT_CATALOG_FILTERS,
      search: 'lamp',
      category: 'home',
      minPrice: 10,
      maxPrice: 50,
      inStock: true,
      sort: 'PriceAsc',
      page: 3,
    });
  });

  it('falls back to defaults for hostile or invalid input', () => {
    const filters = filtersFromParams(
      convertToParamMap({ sort: 'DROP TABLE', page: '-2', minPrice: 'abc', maxPrice: '-5', search: 'x'.repeat(500) }),
    );

    expect(filters.sort).toBe('Newest');
    expect(filters.page).toBe(1);
    expect(filters.minPrice).toBeNull();
    expect(filters.maxPrice).toBeNull();
    expect(filters.search).toHaveLength(100);
  });

  it('drops an inverted price range instead of sending an invalid query', () => {
    expect(filtersFromParams(convertToParamMap({ minPrice: '80', maxPrice: '20' }))).toMatchObject({ minPrice: 80, maxPrice: null });
  });

  it('writes only non-default values, so the default catalog URL stays clean', () => {
    expect(Object.values(filtersToParams(DEFAULT_CATALOG_FILTERS)).every((value) => value === null)).toBe(true);
  });

  it('round-trips', () => {
    const filters = { ...DEFAULT_CATALOG_FILTERS, brand: 'Acme', page: 2, sort: 'Rating' as const };
    const params = Object.fromEntries(Object.entries(filtersToParams(filters)).filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)]));
    expect(filtersFromParams(convertToParamMap(params))).toEqual(filters);
  });
});
