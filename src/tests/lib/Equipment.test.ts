import { findEquipment, getTestMonster, getTestPlayer } from '@/tests/utils/TestUtils';
import { describe, expect, test } from '@jest/globals';
import {
  calculateEquipmentBonusesFromGear,
  getCanonicalEquipment,
  getCanonicalItemId,
  placeAmmoInQuiverSlots,
} from '@/lib/Equipment';

describe('calculateEquipmentBonusesFromGear', () => {
  test('holy and sanguine scythes remain distinct equipment entries', () => {
    expect(getCanonicalItemId(findEquipment('Scythe of vitur', 'Charged').id)).toBe(findEquipment('Scythe of vitur', 'Charged').id);
    expect(getCanonicalItemId(findEquipment('Scythe of vitur', 'Uncharged').id)).toBe(findEquipment('Scythe of vitur', 'Uncharged').id);
    expect(getCanonicalItemId(findEquipment('Holy scythe of vitur', 'Charged').id)).toBe(findEquipment('Holy scythe of vitur', 'Charged').id);
    expect(getCanonicalItemId(findEquipment('Holy scythe of vitur', 'Uncharged').id)).toBe(findEquipment('Holy scythe of vitur', 'Uncharged').id);
    expect(getCanonicalItemId(findEquipment('Sanguine scythe of vitur', 'Charged').id)).toBe(findEquipment('Sanguine scythe of vitur', 'Charged').id);
    expect(getCanonicalItemId(findEquipment('Sanguine scythe of vitur', 'Uncharged').id)).toBe(findEquipment('Sanguine scythe of vitur', 'Uncharged').id);
  });

  test("dharok's greataxe variants remain distinct equipment entries", () => {
    expect(getCanonicalItemId(findEquipment("Dharok's greataxe", 'Undamaged').id)).toBe(findEquipment("Dharok's greataxe", 'Undamaged').id);
    expect(getCanonicalItemId(findEquipment("Dharok's greataxe", '100').id)).toBe(findEquipment("Dharok's greataxe", '100').id);
    expect(getCanonicalItemId(findEquipment("Dharok's greataxe", '75').id)).toBe(findEquipment("Dharok's greataxe", '75').id);
    expect(getCanonicalItemId(findEquipment("Dharok's greataxe", '50').id)).toBe(findEquipment("Dharok's greataxe", '50').id);
    expect(getCanonicalItemId(findEquipment("Dharok's greataxe", '25').id)).toBe(findEquipment("Dharok's greataxe", '25').id);
    expect(getCanonicalItemId(findEquipment("Dharok's greataxe", '0').id)).toBe(findEquipment("Dharok's greataxe", '0').id);
  });

  describe("with Dizana's quiver", () => {
    describe('with weapon using ammo slot', () => {
      test('applies bonus when charged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Charged'),
            weapon: findEquipment('Twisted bow'),
            ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(98);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(84);
      });

      test('applies bonus when blessed', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Blessed dizana's quiver", 'Normal'),
            weapon: findEquipment('Twisted bow'),
            ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(98);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(84);
      });

      test('does not apply bonus when uncharged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Uncharged'),
            weapon: findEquipment('Twisted bow'),
            ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(88);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(83);
      });

      test('normalizes compatible projectile ammo into the primary ammo slot', () => {
        const normalized = getCanonicalEquipment({
          head: null,
          cape: findEquipment("Dizana's quiver", 'Charged'),
          neck: null,
          ammo: findEquipment('Crystal blessing'),
          ammo2: findEquipment('Dragon arrow', 'Unpoisoned'),
          weapon: findEquipment('Twisted bow'),
          body: null,
          shield: null,
          legs: null,
          hands: null,
          feet: null,
          ring: null,
        });

        expect(normalized.ammo?.name).toBe('Dragon arrow');
        expect(normalized.ammo2?.name).toBe('Crystal blessing');
      });

      test('places arrows and blessing into separate slots through quiver placement rules', () => {
        const equipment = {
          head: null,
          cape: findEquipment("Dizana's quiver", 'Charged'),
          neck: null,
          ammo: findEquipment('Crystal blessing'),
          ammo2: null,
          weapon: findEquipment('Twisted bow'),
          body: null,
          shield: null,
          legs: null,
          hands: null,
          feet: null,
          ring: null,
        };

        const placed = placeAmmoInQuiverSlots(equipment, findEquipment('Dragon arrow', 'Unpoisoned'));

        expect(placed.ammo?.name).toBe('Dragon arrow');
        expect(placed.ammo2?.name).toBe('Crystal blessing');
      });
    });
    describe('with weapon not using ammo slot', () => {
      test('does not apply bonus when charged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Charged'),
            weapon: findEquipment('Dragon dart'),
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(18);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(38);
      });

      test('does not apply bonus when blessed', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Blessed dizana's quiver", 'Normal'),
            weapon: findEquipment('Dragon dart'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(18);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(38);
      });

      test('does not apply bonus when uncharged', () => {
        const monster = getTestMonster('Abyssal demon', 'Standard');
        const playerWithChargedQuiver = getTestPlayer(monster, {
          equipment: {
            cape: findEquipment("Dizana's quiver", 'Uncharged'),
            weapon: findEquipment('Dragon dart'),
          },
          offensive: {
            ranged: 0,
          },
          bonuses: {
            ranged_str: 0,
          },
        });

        const bonuses = calculateEquipmentBonusesFromGear(playerWithChargedQuiver, monster);
        expect(bonuses.offensive.ranged).toStrictEqual(18);
        expect(bonuses.bonuses.ranged_str).toStrictEqual(38);
      });
    });
  });
});
