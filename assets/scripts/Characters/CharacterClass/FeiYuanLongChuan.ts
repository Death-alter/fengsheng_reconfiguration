import { Character } from "../Character";
import { Sex, CharacterStatus } from "../type";
import { Skill } from "../../Skills/Skill";

export class FeiYuanLongChuan extends Character {
  constructor() {
    super({
      id: 7,
      name: "肥圆龙川",
      sprite: "images/characters/FeiYuanLongChuan",
      status: CharacterStatus.FACE_UP,
      sex: Sex.MALE,
      skills: [] as Skill[],
    });
  }
}