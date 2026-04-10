import { describe, expect, test } from '@jest/globals';
import { Prayer } from '@/enums/Prayer';
import Potion from '@/enums/Potion';
import { DetailKey } from '@/lib/CalcDetails';
import { calculateEquipmentBonusesFromGear } from '@/lib/Equipment';
import BaseCalc from '@/lib/BaseCalc';
import PlayerVsNPCCalc from '@/lib/PlayerVsNPCCalc';
import {
  calculatePlayerVsNpc,
  findEquipment,
  findResult,
  findSpell,
  getTestMonster,
  getTestPlayer,
} from '@/tests/utils/TestUtils';
import { Player } from '@/types/Player';
import { PartialDeep } from 'type-fest';

const monster = getTestMonster('Abyssal demon', 'Standard');

const getSpellPlayer = (
  spellName: string,
  overrides: PartialDeep<Player> = {},
) => getTestPlayer(monster, {
  equipment: {
    weapon: findEquipment('Staff'),
  },
  style: {
    name: 'Spell',
    type: 'magic',
    stance: 'Manual Cast',
  },
  spell: findSpell(spellName),
  ...overrides,
});

const getAccurateMinimum = (dist: ReturnType<typeof calculatePlayerVsNpc>['dist']['dists'][number]) => Math.min(
  ...dist.hits
    .filter((hit) => hit.hitsplats.some((hitsplat) => hitsplat.accurate))
    .map((hit) => hit.getSum()),
);

describe('Demonic pacts', () => {
  test('buffed ranged prayers increase ranged accuracy and damage', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      prayers: [Prayer.RIGOUR],
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      prayers: [Prayer.RIGOUR],
      leagues: {
        six: {
          effects: {
            talent_buffed_ranged_prayers: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(boosted.maxAttackRoll).toBeGreaterThan(base.maxAttackRoll);
    expect(boosted.maxHit).toBeGreaterThan(base.maxHit);
  });

  test('melee strength scales from worn prayer bonus', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
        neck: findEquipment('Holy symbol'),
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
        neck: findEquipment('Holy symbol'),
      },
      leagues: {
        six: {
          effects: {
            talent_melee_strength_prayer_bonus: 1,
          },
        },
      },
    });

    const baseBonuses = calculateEquipmentBonusesFromGear(basePlayer, monster);
    const boostedBonuses = calculateEquipmentBonusesFromGear(boostedPlayer, monster);

    expect(boostedBonuses.bonuses.str).toBeGreaterThan(baseBonuses.bonuses.str);
  });

  test('light melee weapons gain an additional hit distribution', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Dragon dagger'),
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Dragon dagger'),
      },
      leagues: {
        six: {
          effects: {
            talent_light_weapon_doublehit: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(boosted.dist.dists.length).toBeGreaterThan(base.dist.dists.length);
    expect(boosted.dps).toBeGreaterThan(base.dps);
  });

  test('distance-based melee bonuses scale from league distance', () => {
    const closePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
      },
      leagues: {
        six: {
          distanceToEnemy: 0,
          effects: {
            talent_distance_melee_minhit: 3,
            talent_percentage_melee_maxhit_distance: 4,
          },
        },
      },
    });
    const farPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
      },
      leagues: {
        six: {
          distanceToEnemy: 6,
          effects: {
            talent_distance_melee_minhit: 3,
            talent_percentage_melee_maxhit_distance: 4,
          },
        },
      },
    });

    const close = calculatePlayerVsNpc(monster, closePlayer);
    const far = calculatePlayerVsNpc(monster, farPlayer);

    expect(findResult(far.details, DetailKey.MIN_HIT_FINAL)).toBeGreaterThan(findResult(close.details, DetailKey.MIN_HIT_FINAL) as number);
    expect(far.maxHit).toBeGreaterThan(close.maxHit);
  });

  test('distance-based min hit cannot exceed final max hit on split light-weapon attacks', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Dragon dagger'),
      },
      leagues: {
        six: {
          distanceToEnemy: 6,
          effects: {
            talent_light_weapon_doublehit: 1,
            talent_distance_melee_minhit: 3,
            talent_percentage_melee_maxhit_distance: 4,
          },
        },
      },
    });

    const result = calculatePlayerVsNpc(monster, player);

    expect(findResult(result.details, DetailKey.MIN_HIT_FINAL)).toBeLessThanOrEqual(result.maxHit);
  });

  test('multihit melee pact minimums apply per hitsplat for standard two-hit weapons', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Earthbound tecpatl'),
      },
      leagues: {
        six: {
          distanceToEnemy: 6,
          effects: {
            talent_distance_melee_minhit: 3,
          },
        },
      },
    });

    const result = calculatePlayerVsNpc(monster, player);
    const accurateMinimums = result.dist.dists.map(getAccurateMinimum);

    expect(accurateMinimums).toEqual([21, 21]);
  });

  test('blindbag sub-calcs keep per-hitsplat melee minimums on multihit weapons', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Earthbound tecpatl'),
      },
      leagues: {
        six: {
          distanceToEnemy: 6,
          effects: {
            talent_distance_melee_minhit: 3,
          },
        },
      },
    });

    const calc = new PlayerVsNPCCalc(player, monster, {
      loadoutName: 'blindbag-earthbound',
      detailedOutput: true,
      isBlindBag: true,
    });
    const accurateMinimums = calc.getDistribution().dists.map(getAccurateMinimum);

    expect(accurateMinimums).toEqual([21, 21]);
  });

  test('crystal blessing adds visible magic stats per crystal armour piece', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Staff'),
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Staff'),
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
    });

    const baseBonuses = calculateEquipmentBonusesFromGear(basePlayer, monster);
    const boostedBonuses = calculateEquipmentBonusesFromGear(boostedPlayer, monster);

    expect(boostedBonuses.offensive.magic).toBe(baseBonuses.offensive.magic + 60);
    expect(boostedBonuses.bonuses.magic_str).toBe(baseBonuses.bonuses.magic_str + 60);
    expect(boostedBonuses.bonuses.prayer).toBe(baseBonuses.bonuses.prayer + 3);
  });

  test('drygore blowpipe uses the better of two accuracy rolls and can burn targets', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: {
          ...findEquipment('Drygore blowpipe', 'Charged'),
          itemVars: {
            blowpipeDartId: findEquipment('Dragon dart').id,
            blowpipeDartName: 'Dragon dart',
          },
        },
      },
    });

    const result = calculatePlayerVsNpc(monster, player);

    expect(result.accuracy).toBeCloseTo(BaseCalc.getFangAccuracyRoll(result.maxAttackRoll, result.npcDefRoll), 10);
    expect(findResult(result.details, DetailKey.DOT_EXPECTED)).toBeGreaterThan(0);
  });

  test('devils element adds elemental weakness to fire spells', () => {
    const neutralMonster = getTestMonster('Abyssal demon', 'Standard', {
      weakness: null,
    });
    const basePlayer = getSpellPlayer('Fire Wave', {
      equipment: {
        weapon: findEquipment('Staff'),
      },
    });
    const devilPlayer = getSpellPlayer('Fire Wave', {
      equipment: {
        weapon: findEquipment('Staff'),
        shield: findEquipment("Devil's element"),
      },
    });

    const base = calculatePlayerVsNpc(neutralMonster, basePlayer);
    const devil = calculatePlayerVsNpc(neutralMonster, devilPlayer);

    expect(devil.maxHit).toBeGreaterThan(base.maxHit);
    expect(devil.accuracy).toBeGreaterThan(base.accuracy);
  });

  test('shadowflame quadrant adds a follow-up hit to standard elemental spells', () => {
    const player = getSpellPlayer('Fire Wave', {
      equipment: {
        weapon: findEquipment('Shadowflame quadrant'),
      },
      style: {
        name: 'Spell',
        type: 'magic',
        stance: 'Autocast',
      },
    });

    const result = calculatePlayerVsNpc(monster, player);

    expect(result.dist.dists[0].hits.some((hit) => hit.hitsplats.length === 2)).toBe(true);
  });

  test('kings barrage fires a second hit and its ice bolt benefits from water pact logic', () => {
    const barrage = findEquipment("King's barrage");
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: barrage,
        ammo: findEquipment('Diamond dragon bolts (e)'),
      },
      style: {
        name: 'Rapid',
        type: 'ranged',
        stance: 'Rapid',
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: barrage,
        ammo: findEquipment('Diamond dragon bolts (e)'),
      },
      style: {
        name: 'Rapid',
        type: 'ranged',
        stance: 'Rapid',
      },
      boosts: {
        hp: 51,
      },
      leagues: {
        six: {
          effects: {
            talent_ice_counts_as_water: 1,
            talent_water_spell_damage_high_hp: 1,
          },
        },
      },
    });

    const baseBonuses = calculateEquipmentBonusesFromGear(player, monster);
    const base = calculatePlayerVsNpc(monster, player);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(baseBonuses.attackSpeed).toBe(5);
    expect(base.dist.dists.length).toBe(2);
    expect(boosted.dps).toBeGreaterThan(base.dps);
  });

  test('infernal tecpatl hits twice and gains demonbane bonuses against demons', () => {
    const neutralMonster = getTestMonster('Aberrant spectre');
    const demonPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Infernal tecpatl'),
      },
    });
    const neutralPlayer = getTestPlayer(neutralMonster, {
      equipment: {
        weapon: findEquipment('Infernal tecpatl'),
      },
    });

    const demon = calculatePlayerVsNpc(monster, demonPlayer);
    const neutral = calculatePlayerVsNpc(neutralMonster, neutralPlayer);

    expect(demon.dist.dists.length).toBe(2);
    expect(demon.maxHit).toBeGreaterThan(neutral.maxHit);
  });

  test('infernal tecpatl special uses a four-hit claws-style distribution', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Infernal tecpatl'),
      },
    });

    const result = calculatePlayerVsNpc(monster, player, { usingSpecialAttack: true });

    expect(result.dist.dists[0].hits.some((hit) => hit.hitsplats.length === 4)).toBe(true);
  });

  test('lithic sceptre uses a minimum base max hit of 10 at low magic levels', () => {
    const player = getTestPlayer(monster, {
      skills: {
        magic: 30,
      },
      equipment: {
        weapon: findEquipment('Lithic sceptre', 'Charged'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    });

    const result = calculatePlayerVsNpc(monster, player);

    expect(result.maxHit).toBe(10);
  });

  test('lithic sceptre special scales from shatter stacks on the main target hit', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Lithic sceptre', 'Charged'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
      buffs: {
        lithicShatterStacks: 5,
      },
    });

    const normal = calculatePlayerVsNpc(monster, player);
    const special = calculatePlayerVsNpc(monster, player, { usingSpecialAttack: true });

    expect(special.maxHit).toBe(Math.trunc(normal.maxHit * 13 / 10));
  });

  test('crystal blessing gives a larger combat gain to powered staffs than shadowflame quadrant', () => {
    const baseShadow = calculatePlayerVsNpc(monster, getSpellPlayer('Fire Wave', {
      equipment: {
        weapon: findEquipment('Shadowflame quadrant'),
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Spell',
        type: 'magic',
        stance: 'Autocast',
      },
    }));
    const blessedShadow = calculatePlayerVsNpc(monster, getSpellPlayer('Fire Wave', {
      equipment: {
        weapon: findEquipment('Shadowflame quadrant'),
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Spell',
        type: 'magic',
        stance: 'Autocast',
      },
    }));
    const baseLithic = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Lithic sceptre', 'Charged'),
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    }));
    const blessedLithic = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Lithic sceptre', 'Charged'),
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    }));

    expect(blessedLithic.accuracy - baseLithic.accuracy).toBeGreaterThan(blessedShadow.accuracy - baseShadow.accuracy);
  });

  test('crystal blessing visible stats are multiplied by Tumeken\'s shadow', () => {
    const basePlayer = getTestPlayer(monster, {
      skills: {
        magic: 99,
      },
      equipment: {
        weapon: findEquipment("Tumeken's shadow"),
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      skills: {
        magic: 99,
      },
      equipment: {
        weapon: findEquipment("Tumeken's shadow"),
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    });

    const baseBonuses = calculateEquipmentBonusesFromGear(basePlayer, monster);
    const boostedBonuses = calculateEquipmentBonusesFromGear(boostedPlayer, monster);

    expect(boostedBonuses.offensive.magic).toBe(baseBonuses.offensive.magic + 180);
    expect(boostedBonuses.bonuses.magic_str).toBe(baseBonuses.bonuses.magic_str + 180);
    expect(boostedBonuses.bonuses.prayer).toBe(baseBonuses.bonuses.prayer + 3);
  });

  test('crystal blessing powered-staff transfer stays a standard factor on Tumeken\'s shadow', () => {
    const actualPlayer = getTestPlayer(monster, {
      skills: {
        magic: 99,
      },
      equipment: {
        weapon: findEquipment("Tumeken's shadow"),
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    });
    const actualStats = calculateEquipmentBonusesFromGear(actualPlayer, monster);
    const visibleOnlyPlayer = getTestPlayer(monster, {
      skills: {
        magic: 99,
      },
      equipment: {
        weapon: findEquipment("Tumeken's shadow"),
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
      offensive: actualStats.offensive,
      bonuses: actualStats.bonuses,
    });

    const actual = calculatePlayerVsNpc(monster, actualPlayer);
    const visibleOnly = calculatePlayerVsNpc(monster, visibleOnlyPlayer);

    expect(actual.maxAttackRoll).toBe(Math.trunc(visibleOnly.maxAttackRoll * 26 / 20));
    expect(visibleOnly.maxHit).toBe(40);
    expect(actual.maxHit).toBe(46);
  });

  test('crystal blessing expands crystal armour transfer to melee weapons', () => {
    const base = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Flick',
        type: 'slash',
        stance: 'Accurate',
      },
    }));
    const blessed = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Flick',
        type: 'slash',
        stance: 'Accurate',
      },
    }));

    expect(blessed.maxAttackRoll).toBe(Math.trunc(base.maxAttackRoll * 26 / 20));
    expect(blessed.maxHit).toBe(Math.trunc(base.maxHit * 46 / 40));
  });

  test('crystal blessing expands crystal armour transfer to barehanded attacks', () => {
    const base = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        ammo: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Punch',
        type: 'crush',
        stance: 'Accurate',
      },
    }));
    const blessed = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        ammo: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Punch',
        type: 'crush',
        stance: 'Accurate',
      },
    }));

    expect(blessed.maxAttackRoll).toBe(Math.trunc(base.maxAttackRoll * 26 / 20));
    expect(blessed.maxHit).toBe(Math.trunc(base.maxHit * 46 / 40));
  });

  test('crystal blessing still applies from the second quiver ammo slot', () => {
    const base = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        cape: findEquipment("Dizana's quiver", 'Charged'),
        weapon: findEquipment("Tumeken's shadow"),
        ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
        ammo2: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    }));
    const blessed = calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        cape: findEquipment("Dizana's quiver", 'Charged'),
        weapon: findEquipment("Tumeken's shadow"),
        ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
        ammo2: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    }));

    expect(blessed.maxAttackRoll).toBeGreaterThan(base.maxAttackRoll);
    expect(blessed.maxHit).toBeGreaterThan(base.maxHit);
  });

  test('crystal blessing from the second quiver ammo slot gives powered staffs both visible magic damage and crystal transfer', () => {
    const actualPlayer = getTestPlayer(monster, {
      skills: {
        magic: 99,
      },
      equipment: {
        cape: findEquipment("Blessed dizana's quiver", 'Normal'),
        weapon: findEquipment('Lithic sceptre', 'Charged'),
        ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
        ammo2: findEquipment('Crystal blessing'),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
    });
    const actualStats = calculateEquipmentBonusesFromGear(actualPlayer, monster);
    const visibleOnlyPlayer = getTestPlayer(monster, {
      skills: {
        magic: 99,
      },
      equipment: {
        cape: findEquipment("Blessed dizana's quiver", 'Normal'),
        weapon: findEquipment('Lithic sceptre', 'Charged'),
        ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
        ammo2: findEquipment("Rada's blessing 4"),
        head: findEquipment('Crystal helm'),
        body: findEquipment('Crystal body'),
        legs: findEquipment('Crystal legs'),
      },
      style: {
        name: 'Accurate',
        type: 'magic',
        stance: 'Accurate',
      },
      offensive: actualStats.offensive,
      bonuses: actualStats.bonuses,
    });

    const actual = calculatePlayerVsNpc(monster, actualPlayer);
    const visibleOnly = calculatePlayerVsNpc(monster, visibleOnlyPlayer);

    expect(actual.maxAttackRoll).toBe(Math.trunc(visibleOnly.maxAttackRoll * 26 / 20));
    expect(actual.maxHit).toBe(Math.trunc(visibleOnly.maxHit * 46 / 40));
  });

  test('charged quiver still gives its ranged bonus when the projectile starts in ammo2', () => {
    const normalizedFromAmmo2 = calculateEquipmentBonusesFromGear(getTestPlayer(monster, {
      equipment: {
        cape: findEquipment("Dizana's quiver", 'Charged'),
        weapon: findEquipment('Twisted bow'),
        ammo: findEquipment("Rada's blessing 4"),
        ammo2: findEquipment('Dragon arrow', 'Unpoisoned'),
      },
    }), monster);
    const reference = calculateEquipmentBonusesFromGear(getTestPlayer(monster, {
      equipment: {
        cape: findEquipment("Dizana's quiver", 'Charged'),
        weapon: findEquipment('Twisted bow'),
        ammo: findEquipment('Dragon arrow', 'Unpoisoned'),
        ammo2: findEquipment("Rada's blessing 4"),
      },
    }), monster);

    expect(normalizedFromAmmo2.offensive.ranged).toBe(reference.offensive.ranged);
    expect(normalizedFromAmmo2.bonuses.ranged_str).toBe(reference.bonuses.ranged_str);
  });

  test('vs helm matches slayer helmet combat bonuses while on task', () => {
    const vHelmPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
        head: findEquipment("V's helm"),
      },
      buffs: {
        onSlayerTask: true,
      },
    });
    const slayerHelmPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
        head: findEquipment('Slayer helmet (i)'),
      },
      buffs: {
        onSlayerTask: true,
      },
    });

    const vHelm = calculatePlayerVsNpc(monster, vHelmPlayer);
    const slayerHelm = calculatePlayerVsNpc(monster, slayerHelmPlayer);

    expect(vHelm.maxHit).toBeGreaterThan(slayerHelm.maxHit);
  });

  test('fang of the hound special always includes a flames follow-up hitsplat', () => {
    const player = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Fang of the hound'),
      },
    });

    const result = calculatePlayerVsNpc(monster, player, { usingSpecialAttack: true });

    expect(result.dist.dists[0].hits.every((hit) => hit.hitsplats.length === 2)).toBe(true);
  });

  test('max accuracy roll chance starts at 5% and increases by 5% per tile distance', () => {
    const getBoostedAccuracy = (distanceToEnemy: number) => calculatePlayerVsNpc(monster, getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
      },
      leagues: {
        six: {
          distanceToEnemy,
          effects: {
            talent_max_accuracy_roll_from_range: 1,
          },
        },
      },
    }));

    const close = getBoostedAccuracy(0);
    const far = getBoostedAccuracy(6);

    const assertExpectedAccuracy = (result: ReturnType<typeof getBoostedAccuracy>, distanceToEnemy: number) => {
      const baseAccuracy = findResult(result.details, DetailKey.PLAYER_ACCURACY_BASE) as number;
      const maxRollHitChance = Math.min(1, result.maxAttackRoll / (result.npcDefRoll + 1));
      const triggerChance = Math.min(1, (distanceToEnemy + 1) * 0.05);

      expect(result.accuracy).toBeCloseTo(
        ((1 - triggerChance) * baseAccuracy) + (triggerChance * maxRollHitChance),
        10,
      );
    };

    assertExpectedAccuracy(close, 0);
    assertExpectedAccuracy(far, 6);
    expect(far.accuracy).toBeGreaterThan(close.accuracy);
  });

  test('air spell prayer bonus can force more max hits', () => {
    const basePlayer = getSpellPlayer('Wind Wave', {
      equipment: {
        weapon: findEquipment('Staff'),
        neck: findEquipment('Holy symbol'),
      },
    });
    const boostedPlayer = getSpellPlayer('Wind Wave', {
      equipment: {
        weapon: findEquipment('Staff'),
        neck: findEquipment('Holy symbol'),
      },
      leagues: {
        six: {
          effects: {
            talent_air_spell_max_hit_prayer_bonus: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(boosted.dps).toBeGreaterThan(base.dps);
  });

  test('ranged cyclical echoes fan out into three follow-ups after the first echo lands', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
    });
    const echoPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_ammo: 50,
            talent_ranged_regen_echo_chance: 35,
            talent_bow_always_pass_accuracy: 1,
          },
        },
      },
    });
    const cyclicalPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_ammo: 50,
            talent_ranged_regen_echo_chance: 35,
            talent_bow_always_pass_accuracy: 1,
            talent_ranged_echo_cyclical: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const echo = calculatePlayerVsNpc(monster, echoPlayer);
    const cyclical = calculatePlayerVsNpc(monster, cyclicalPlayer);

    const singleEchoExpectedDamage = echo.dist.getExpectedDamage() - base.dist.getExpectedDamage();
    const cyclicalExtraDamage = cyclical.dist.getExpectedDamage() - base.dist.getExpectedDamage();
    const followUpChance = (findResult(echo.details, DetailKey.LEAGUES_ECHO_CHANCE_ACCURACY) as number) / 2;
    const burstMultiplier = 1 + 3 * followUpChance;

    expect(cyclicalExtraDamage).toBeGreaterThan(singleEchoExpectedDamage);
    expect(cyclicalExtraDamage).toBeCloseTo(singleEchoExpectedDamage * burstMultiplier, 1);
    expect(cyclical.dist.dists).toHaveLength(echo.dist.dists.length + 3);
  });

  test('two-handed melee echoes fan out into three follow-ups after the first echo lands', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Saradomin godsword'),
      },
    });
    const echoPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Saradomin godsword'),
      },
      leagues: {
        six: {
          effects: {
            talent_2h_melee_echos: 1,
            talent_bow_always_pass_accuracy: 1,
            talent_crossbow_echo_reproc_chance: 15,
          },
        },
      },
    });
    const cyclicalPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Saradomin godsword'),
      },
      leagues: {
        six: {
          effects: {
            talent_2h_melee_echos: 1,
            talent_bow_always_pass_accuracy: 1,
            talent_crossbow_echo_reproc_chance: 15,
            talent_ranged_echo_cyclical: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const echo = calculatePlayerVsNpc(monster, echoPlayer);
    const cyclical = calculatePlayerVsNpc(monster, cyclicalPlayer);

    const singleEchoExpectedDamage = echo.dist.getExpectedDamage() - base.dist.getExpectedDamage();
    const cyclicalExtraDamage = cyclical.dist.getExpectedDamage() - base.dist.getExpectedDamage();
    const followUpChance = (findResult(echo.details, DetailKey.LEAGUES_ECHO_CHANCE_ACCURACY) as number) / 2;
    const burstMultiplier = 1 + 3 * followUpChance;

    expect(cyclicalExtraDamage).toBeGreaterThan(singleEchoExpectedDamage);
    expect(cyclicalExtraDamage).toBeCloseTo(singleEchoExpectedDamage * burstMultiplier, 1);
    expect(cyclical.dist.dists).toHaveLength(echo.dist.dists.length + 3);
  });

  test('cyclical echoes still apply flat armour to each echo separately', () => {
    const armouredMonster = getTestMonster('Abyssal demon', 'Standard', {
      defensive: {
        flat_armour: 3,
      },
    });

    const basePlayer = getTestPlayer(armouredMonster, {
      skills: {
        ranged: 1,
      },
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
    });
    const echoPlayer = getTestPlayer(armouredMonster, {
      skills: {
        ranged: 1,
      },
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_ammo: 50,
            talent_ranged_regen_echo_chance: 35,
            talent_bow_always_pass_accuracy: 1,
          },
        },
      },
    });
    const cyclicalPlayer = getTestPlayer(armouredMonster, {
      skills: {
        ranged: 1,
      },
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_ammo: 50,
            talent_ranged_regen_echo_chance: 35,
            talent_bow_always_pass_accuracy: 1,
            talent_ranged_echo_cyclical: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(armouredMonster, basePlayer);
    const echo = calculatePlayerVsNpc(armouredMonster, echoPlayer);
    const cyclical = calculatePlayerVsNpc(armouredMonster, cyclicalPlayer);

    expect(echo.dps).toBe(base.dps);
    expect(cyclical.dps).toBe(base.dps);
  });

  test('water spell damage scales with current hp percentage', () => {
    const highHpPlayer = getSpellPlayer('Water Wave', {
      boosts: {
        hp: 0,
      },
      leagues: {
        six: {
          effects: {
            talent_water_spell_damage_high_hp: 1,
          },
        },
      },
    });
    const lowHpPlayer = getSpellPlayer('Water Wave', {
      boosts: {
        hp: -49,
      },
      leagues: {
        six: {
          effects: {
            talent_water_spell_damage_high_hp: 1,
          },
        },
      },
    });

    const highHp = calculatePlayerVsNpc(monster, highHpPlayer);
    const lowHp = calculatePlayerVsNpc(monster, lowHpPlayer);

    expect(highHp.maxHit).toBeGreaterThan(lowHp.maxHit);
  });

  test('water spell damage continues scaling while overhealed above base hp', () => {
    const fullHpPlayer = getSpellPlayer('Water Wave', {
      boosts: {
        hp: 0,
      },
      leagues: {
        six: {
          effects: {
            talent_water_spell_damage_high_hp: 1,
          },
        },
      },
    });
    const overhealedPlayer = getSpellPlayer('Water Wave', {
      boosts: {
        hp: 51,
      },
      leagues: {
        six: {
          effects: {
            talent_water_spell_damage_high_hp: 1,
          },
        },
      },
    });

    const fullHp = calculatePlayerVsNpc(monster, fullHpPlayer);
    const overhealed = calculatePlayerVsNpc(monster, overhealedPlayer);

    expect(overhealed.maxHit).toBeGreaterThan(fullHp.maxHit);
  });

  test('fire spells consume hp for additional damage and burn damage over time', () => {
    const basePlayer = getSpellPlayer('Fire Wave');
    const boostedPlayer = getSpellPlayer('Fire Wave', {
      leagues: {
        six: {
          effects: {
            talent_fire_hp_consume_for_damage: 1,
            talent_fire_spell_burn_bounce: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(boosted.dps).toBeGreaterThan(base.dps);
    expect(findResult(boosted.details, DetailKey.DOT_EXPECTED)).toBeGreaterThan(0);
  });

  test('fire spell damage consumption scales with overhealed hp', () => {
    const fullHpPlayer = getSpellPlayer('Fire Wave', {
      boosts: {
        hp: 0,
      },
      leagues: {
        six: {
          effects: {
            talent_fire_hp_consume_for_damage: 1,
          },
        },
      },
    });
    const overhealedPlayer = getSpellPlayer('Fire Wave', {
      boosts: {
        hp: 51,
      },
      leagues: {
        six: {
          effects: {
            talent_fire_hp_consume_for_damage: 1,
          },
        },
      },
    });

    const fullHp = calculatePlayerVsNpc(monster, fullHpPlayer);
    const overhealed = calculatePlayerVsNpc(monster, overhealedPlayer);

    expect(overhealed.maxHit).toBeGreaterThan(fullHp.maxHit);
  });

  test('prayer penetration partially bypasses enemy protection prayers', () => {
    const noPrayerPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
    });
    const prayedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      leagues: {
        six: {
          enemyPrayers: {
            melee: false,
            ranged: true,
            magic: false,
          },
        },
      },
    });
    const penetratedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Bow of faerdhinen'),
      },
      leagues: {
        six: {
          enemyPrayers: {
            melee: false,
            ranged: true,
            magic: false,
          },
          effects: {
            talent_prayer_pen_all: 15,
          },
        },
      },
    });

    const noPrayer = calculatePlayerVsNpc(monster, noPrayerPlayer);
    const prayed = calculatePlayerVsNpc(monster, prayedPlayer);
    const penetrated = calculatePlayerVsNpc(monster, penetratedPlayer);

    expect(prayed.dps).toBeLessThan(noPrayer.dps);
    expect(penetrated.dps).toBeGreaterThan(prayed.dps);
  });

  test('regenerated magic bonus increases magic accuracy and damage', () => {
    const basePlayer = getSpellPlayer('Magic Dart', {
      equipment: {
        weapon: findEquipment("Slayer's staff"),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_magic_level_boost: 10,
          },
          regenerateMagicBonus: 0,
        },
      },
    });
    const boostedPlayer = getSpellPlayer('Magic Dart', {
      equipment: {
        weapon: findEquipment("Slayer's staff"),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_magic_level_boost: 10,
          },
          regenerateMagicBonus: 5,
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(boosted.maxAttackRoll).toBeGreaterThan(base.maxAttackRoll);
    expect(boosted.maxHit).toBeGreaterThan(base.maxHit);
  });

  test('regenerated magic bonus does not stack with ordinary magic potion boosts', () => {
    const pactOnlyPlayer = getSpellPlayer('Magic Dart', {
      equipment: {
        weapon: findEquipment("Slayer's staff"),
      },
      leagues: {
        six: {
          effects: {
            talent_regen_magic_level_boost: 10,
          },
          regenerateMagicBonus: 10,
        },
      },
    });
    const potionAndPactPlayer = getSpellPlayer('Magic Dart', {
      equipment: {
        weapon: findEquipment("Slayer's staff"),
      },
      boosts: {
        magic: 4,
      },
      buffs: {
        potions: [Potion.MAGIC],
      },
      leagues: {
        six: {
          effects: {
            talent_regen_magic_level_boost: 10,
          },
          regenerateMagicBonus: 10,
        },
      },
    });

    const pactOnly = calculatePlayerVsNpc(monster, pactOnlyPlayer);
    const potionAndPact = calculatePlayerVsNpc(monster, potionAndPactPlayer);

    expect(potionAndPact.maxAttackRoll).toBe(pactOnly.maxAttackRoll);
    expect(potionAndPact.maxHit).toBe(pactOnly.maxHit);
  });

  test('overheal consumption increases melee minimum hit when overhealed hp is available', () => {
    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
      },
      boosts: {
        hp: 5,
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal whip'),
      },
      boosts: {
        hp: 5,
      },
      leagues: {
        six: {
          effects: {
            talent_overheal_consumption_boost: 1,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(findResult(boosted.details, DetailKey.MIN_HIT_FINAL)).toBeGreaterThan(findResult(base.details, DetailKey.MIN_HIT_FINAL) as number);
  });

  test('blindbag attacks increase melee damage and scale from configured weapons', () => {
    const blindbagWeapons = [
      findEquipment('Abyssal bludgeon'),
      findEquipment('Dragon scimitar'),
      findEquipment('Bandos godsword'),
      findEquipment('Dragon 2h sword'),
      findEquipment('Barrelchest anchor'),
    ];

    const basePlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal bludgeon'),
      },
    });
    const boostedPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal bludgeon'),
      },
      leagues: {
        six: {
          blindbagWeapons,
          effects: {
            talent_free_random_weapon_attack_chance: 15,
            talent_unique_blindbag_chance: 1,
            talent_unique_blindbag_damage: 2,
          },
        },
      },
    });

    const base = calculatePlayerVsNpc(monster, basePlayer);
    const boosted = calculatePlayerVsNpc(monster, boostedPlayer);

    expect(boosted.dps).toBeGreaterThan(base.dps);
    expect(boosted.maxHit).toBeGreaterThan(base.maxHit);
  });

  test('blindbag unique bonuses are based on unique item ids, not duplicate copies', () => {
    const oneWeaponPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal bludgeon'),
      },
      leagues: {
        six: {
          blindbagWeapons: [findEquipment('Abyssal bludgeon')],
          effects: {
            talent_free_random_weapon_attack_chance: 15,
            talent_unique_blindbag_chance: 1,
            talent_unique_blindbag_damage: 2,
          },
        },
      },
    });
    const duplicateWeaponsPlayer = getTestPlayer(monster, {
      equipment: {
        weapon: findEquipment('Abyssal bludgeon'),
      },
      leagues: {
        six: {
          blindbagWeapons: Array.from({ length: 5 }, () => findEquipment('Abyssal bludgeon')),
          effects: {
            talent_free_random_weapon_attack_chance: 15,
            talent_unique_blindbag_chance: 1,
            talent_unique_blindbag_damage: 2,
          },
        },
      },
    });

    const oneWeapon = calculatePlayerVsNpc(monster, oneWeaponPlayer);
    const duplicateWeapons = calculatePlayerVsNpc(monster, duplicateWeaponsPlayer);

    expect(duplicateWeapons.dps).toBeCloseTo(oneWeapon.dps, 10);
    expect(duplicateWeapons.maxHit).toBe(oneWeapon.maxHit);
  });
});
