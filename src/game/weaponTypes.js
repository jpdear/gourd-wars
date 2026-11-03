// Every melee weapon (farm tools that drop from the sky). How a weapon is used is in weapons.js;
// this is just each one's numbers. Like a pumpkin, a weapon takes your hands.
//   name, colors              how it looks (its shape is in render/weapons.js)
//   uses                      how many times it can connect (a hit, a bale, a pumpkin, a wall...)
//                             before it snaps. A swing uses at most one, however much it hits.
//   carry                     while held: { speed, jump } multipliers, wallStick: false, slide: false
//                             (same as a pumpkin's carry)
//   length, grip              the whole tool, and how far up from the butt end the back hand holds it (m)
//   handGap                   the front hand: this much further up the handle (m)
//   hold                      held, the grip (the back hand) rests this far out from the chest along the tool
//                             (m; negative: pulled back beside the body, leaving the arms room to push it out)
//   blade, headWidth          the head (what hits things): the last `blade` m of the tool, this wide
//   bladeRadius               ...and how close a pumpkin or a shield has to be to its center line to count (m)
//   heft                      held, it's a real body pulled along with you (see weapons.js):
//     mass                    its mass (kg; a player is about 2.2)
//     force, torque           how hard it can be pulled (N) and turned (N·m) toward where it should be:
//                             lower = heavier (it lags and swings with momentum), and easier to stop
//     snap                    how much of the way there it tries to get each step (0..1)
//   tap                       a quick click:
//     motion                  how it moves (see MOTIONS in weapons.js)
//     time, cooldown          how long the swing takes, and the wait after it before the next (s)
//     reach                   (thrust) how far the arms push the tool out along the aim (m; with handGap and
//                             hold, the front hand mustn't end up past arm's length: ~0.65 m out from the chest)
//     lunge                   { speed, time }: you lunge along the aim (sideways) at this speed (m/s) for this long (s)
//     damage, knockback, stun a hit (staggers at CONFIG.damage.staggerAt; stun = ragdoll time if it does)
//     cost                    uses it costs if it touches anything (default 1)
//   charge                    keep holding after the tap, and let go once fully charged: the same as a tap, plus
//     chargeTime              how long to hold (from the press) until it's fully charged (s)
//     grab                    the first one it hits is caught on the blade, helpless:
//       time                  ...carried for at most this long (s; a click flings them sooner)
//       carrySpeed            ...slowing you down this much (× your speed)
//       fling                 { speed, damage, stun }: then flung off it toward the aim

export const WEAPON_TYPES = {
  pitchfork: {
    name: 'Pitchfork', color: '#9a6a3a', metal: '#8d949c', uses: 8,
    carry: {},
    length: 1.6, grip: 0.15, handGap: 0.38, hold: -0.05, blade: 0.4, headWidth: 0.24, bladeRadius: 0.1,   // (the tines reach ~1–1.4 m out; a thrust: ~2.8 m from where you started)
    heft: { mass: 0.4, force: 80, torque: 60, snap: 0.3 },   // (a slight weight: ~0.1 s to swing round to a new aim, overshooting a little)
    tap: { motion: 'thrust', time: 0.3, cooldown: 0.25, reach: 0.3, lunge: { speed: 7, time: 0.2 }, damage: 12, knockback: 7, stun: 0.8 },
    charge: {   // Skewer: hoisted overhead on the tines, then flung
      motion: 'thrust', chargeTime: 0.7, time: 0.35, cooldown: 0.3, reach: 0.3, lunge: { speed: 10, time: 0.22 }, cost: 2,
      damage: 5, knockback: 7, stun: 0.8,
      grab: { time: 1, carrySpeed: 0.6, fling: { speed: 18, damage: 15, stun: 1 } },
    },
  },
}
export const WEAPON_TYPE_NAMES = Object.keys(WEAPON_TYPES)   // index = type code in snapshots
