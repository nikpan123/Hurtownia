import assert from 'node:assert/strict';

export function packageWeightBody(entries, weightGrams) {
  assert(Number.isSafeInteger(weightGrams) && weightGrams > 0, 'Waga QA musi być dodatnią liczbą gramów');
  const key = 'sylius_product[variant][weight]';
  assert(entries.some(([name]) => name === key), 'Formularz CMS nie zawiera znanego pola wagi wariantu');
  const body = new URLSearchParams(entries);
  body.set(key, String(weightGrams));
  return body;
}
