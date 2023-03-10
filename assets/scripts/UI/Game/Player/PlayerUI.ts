import { _decorator, Component, Label, Node } from "cc";
import { CharacterPanting } from "../Character/CharacterPanting";
import Player from "../../../Data/Player/Player";
import { ProgressControl } from "../../../Utils/ProgressControl";

const { ccclass, property } = _decorator;

@ccclass("PlayerUI")
export class PlayerUI extends Component {
  @property(Node)
  characterPanting: Node | null = null;
  @property(Node)
  progress: Node | null = null;
  @property(Node)
  messageCounts: Node | null = null;

  public static readonly seatNumberText: string[] = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

  private _player: Player;

  get player() {
    return this._player;
  }
  set player(player: Player) {
    if (player === this._player) return;
    if (player) {
      this._player = player;
      if (this._player.UI !== this) this._player.UI = this;
      this.characterPanting.getComponent(CharacterPanting).character = player.character;
      this.node.getChildByPath("Border/UserName/Label").getComponent(Label).string = player.name;
    } else if (this._player) {
      const player = this._player;
      this._player = null;
      player.UI = null;
    }
  }

  onLoad() {
    this.progress.active = false;
  }

  //设置座位文字
  setSeat(seatNumber: number) {
    this.node.getChildByName("SeatNumber").getComponent(Label).string = PlayerUI.seatNumberText[seatNumber];
  }

  //倒计时
  startCoundDown(seconds) {
    this.progress.getComponent(ProgressControl).startCoundDown(seconds);
  }

  stopCountDown() {
    this.progress.getComponent(ProgressControl).stopCountDown();
  }

  //刷新手牌数量
  refreshHandCardCount() {
    this.messageCounts.getChildByPath("HandCard/Label").getComponent(Label).string =
      this.player.handCards.length.toString();
  }

  refreshMessageCount() {
    const arr = [0, 0, 0];
    for (let item of this.player.messages) {
      for (let color of item.color) {
        ++arr[color];
      }
    }
    this.messageCounts.getChildByPath("Black/Label").getComponent(Label).string = arr[0].toString();
    this.messageCounts.getChildByPath("Red/Label").getComponent(Label).string = arr[1].toString();
    this.messageCounts.getChildByPath("Blue/Label").getComponent(Label).string = arr[2].toString();
  }
}
