const ICONS = {
  lv1:   require('../../assets/img/userIcons/user1-29.png'),
  lv30:  require('../../assets/img/userIcons/user30-39.png'),
  lv40:  require('../../assets/img/userIcons/user40-49.png'),
  lv50:  require('../../assets/img/userIcons/user50-59.png'),
  lv60:  require('../../assets/img/userIcons/user60-69.png'),
  lv70:  require('../../assets/img/userIcons/user70-79.png'),
  lv80:  require('../../assets/img/userIcons/user80-89.png'),
  lv90:  require('../../assets/img/userIcons/user90-99.png'),
  lv100: require('../../assets/img/userIcons/user100.png'),
} as const;

export function getUserIcon(level: number): (typeof ICONS)[keyof typeof ICONS] {
  if (level >= 100) return ICONS.lv100;
  if (level >= 90)  return ICONS.lv90;
  if (level >= 80)  return ICONS.lv80;
  if (level >= 70)  return ICONS.lv70;
  if (level >= 60)  return ICONS.lv60;
  if (level >= 50)  return ICONS.lv50;
  if (level >= 40)  return ICONS.lv40;
  if (level >= 30)  return ICONS.lv30;
  return ICONS.lv1;
}
