import { expect, test } from '@jest/globals';
import { EquipmentCategory } from '@/enums/EquipmentCategory';
import { generateEmptyPlayer } from '@/state';
import { getCombatStylesForCategory, isValidBlindbagWeapon } from '@/utils';
import { findEquipment } from '@/tests/utils/TestUtils';

test('getCombatStylesForCategory', () => {
  expect(getCombatStylesForCategory(EquipmentCategory.BLUDGEON)).toEqual([
    { name: 'Pound', type: 'crush', stance: 'Aggressive' },
    { name: 'Pummel', type: 'crush', stance: 'Aggressive' },
    { name: 'Smash', type: 'crush', stance: 'Aggressive' },
    { name: 'Spell', type: 'magic', stance: 'Manual Cast' },
  ]);

  expect(getCombatStylesForCategory(EquipmentCategory.DAGGER)).toEqual([
    { name: 'Stab', type: 'stab', stance: 'Accurate' },
    { name: 'Lunge', type: 'stab', stance: 'Aggressive' },
    { name: 'Slash', type: 'slash', stance: 'Aggressive' },
    { name: 'Block', type: 'stab', stance: 'Defensive' },
    { name: 'Spell', type: 'magic', stance: 'Manual Cast' },
  ]);
});

test('isValidBlindbagWeapon accepts heavy melee weapons and rejects non-melee weapons', () => {
  expect(isValidBlindbagWeapon(findEquipment('Scythe of vitur', 'Charged'))).toBe(true);
  expect(isValidBlindbagWeapon(findEquipment('Abyssal bludgeon'))).toBe(true);
  expect(isValidBlindbagWeapon(findEquipment('Bow of faerdhinen'))).toBe(false);
  expect(isValidBlindbagWeapon(findEquipment('Staff'))).toBe(false);
});

test('new league items are present with the expected combat categories and slots', () => {
  const infernalTecpatl = findEquipment('Infernal tecpatl');
  expect(infernalTecpatl.slot).toBe('weapon');
  expect(infernalTecpatl.category).toBe(EquipmentCategory.SPEAR);
  expect(infernalTecpatl.isTwoHanded).toBe(true);
  expect(infernalTecpatl.weight).toBeGreaterThanOrEqual(1);

  const fangOfTheHound = findEquipment('Fang of the hound');
  expect(fangOfTheHound.category).toBe(EquipmentCategory.DAGGER);
  expect(fangOfTheHound.weight).toBeLessThan(1);

  const drygoreBlowpipe = findEquipment('Drygore blowpipe', 'Charged');
  expect(drygoreBlowpipe.category).toBe(EquipmentCategory.THROWN);
  expect(drygoreBlowpipe.isTwoHanded).toBe(true);

  expect(findEquipment("V's helm").slot).toBe('head');
  expect(findEquipment('Shadowflame quadrant').category).toBe(EquipmentCategory.STAFF);
  expect(findEquipment("Devil's element").slot).toBe('shield');
  expect(findEquipment("Nature's recurve").category).toBe(EquipmentCategory.BOW);
  expect(findEquipment('Lithic sceptre', 'Charged').category).toBe(EquipmentCategory.POWERED_STAFF);
  expect(findEquipment('Crystal blessing').slot).toBe('ammo');
  expect(findEquipment("King's barrage").category).toBe(EquipmentCategory.CROSSBOW);
});

test('generateEmptyPlayer includes lithic sceptre stacks with a zero default', () => {
  expect((generateEmptyPlayer().buffs as Record<string, unknown>).lithicShatterStacks).toBe(0);
});
