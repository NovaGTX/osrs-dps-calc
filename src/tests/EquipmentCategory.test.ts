import { expect, test } from '@jest/globals';
import { EquipmentCategory } from '@/enums/EquipmentCategory';
import { getCombatStylesForCategory, isValidBlindbagWeapon } from '@/utils';
import { findEquipment } from '@/tests/utils/TestUtils';

test('getCombatStylesForCategory', () => {
  expect(getCombatStylesForCategory(EquipmentCategory.BLUDGEON)).toEqual([
    { name: 'Pound', type: 'crush', stance: 'Aggressive' },
    { name: 'Pummel', type: 'crush', stance: 'Aggressive' },
    { name: 'Smash', type: 'crush', stance: 'Aggressive' },
    { name: 'Spell', type: 'magic', stance: 'Manual Cast' },
  ]);
});

test('isValidBlindbagWeapon accepts heavy melee weapons and rejects non-melee weapons', () => {
  expect(isValidBlindbagWeapon(findEquipment('Scythe of vitur', 'Charged'))).toBe(true);
  expect(isValidBlindbagWeapon(findEquipment('Abyssal bludgeon'))).toBe(true);
  expect(isValidBlindbagWeapon(findEquipment('Bow of faerdhinen'))).toBe(false);
  expect(isValidBlindbagWeapon(findEquipment('Staff'))).toBe(false);
});
