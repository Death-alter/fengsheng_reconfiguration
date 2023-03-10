import { _decorator, Component, Node, Prefab, instantiate, Label, resources, Layout, tween, Vec3 } from "cc";
import { SelectCharacter } from "../UI/Game/SelectCharacter/SelectCharacter";
import { GamePhase } from "./type";
import {
  wait_for_select_role_toc,
  init_toc,
  notify_phase_toc,
  sync_deck_num_toc,
  add_card_toc,
  notify_role_update_toc,
  discard_card_toc,
  use_shi_tan_toc,
  show_shi_tan_toc,
  execute_shi_tan_toc,
  use_ping_heng_toc,
  wei_bi_wait_for_give_card_toc,
  wei_bi_show_hand_card_toc,
  wei_bi_give_card_toc,
  use_cheng_qing_toc,
  send_message_card_toc,
  choose_receive_toc,
  notify_dying_toc,
  notify_die_toc,
  wait_for_cheng_qing_toc,
  wait_for_die_give_card_toc,
  notify_winner_toc,
  use_po_yi_toc,
  po_yi_show_toc,
  use_jie_huo_toc,
  use_diao_bao_toc,
  use_wu_dao_toc,
  use_feng_yun_bian_huan_toc,
  wait_for_feng_yun_bian_huan_choose_card_toc,
  feng_yun_bian_huan_choose_card_toc,
  card,
} from "../../protobuf/proto.d";
import EventTarget from "../Event/EventTarget";
import { ProcessEvent, GameEvent } from "../Event/type";
import { Card, UnknownCard } from "../Data/Cards/Card";
import { CardColor, CardDirection, CardStatus, CardType, GameCard } from "../Data/Cards/type";
import { createIdentity } from "../Data/Identity";
import { Identity } from "../Data/Identity/Identity";
import { IdentityType, SecretTaskType } from "../Data/Identity/type";
import { CharacterStatus, CharacterType } from "../Data/Characters/type";
import Player from "../Data/Player/Player";
import { createCharacterById } from "../Data/Characters";
import { PlayerUI } from "../UI/Game/Player/PlayerUI";
import { createCard, createUnknownCard } from "../Data/Cards";
import { CardUsage } from "../Data/Cards/type";
import { HandCardUI } from "../UI/Game/UIContainer/HandCardUI";
import { ProgressControl } from "../Utils/ProgressControl";
import { CardUI } from "../UI/Game/Card/CardUI";
import { HandCardList } from "../Data/DataContainer/HandCardList";
import { CardGroup } from "../Data/DataContainer/CardGroup";
import { CardGroupNode } from "../UI/Game/UIContainer/CardGroupNode";
import { DataContainer } from "../Data/DataContainer/DataContainer";
import { ActionPlayer } from "./ActionPlayer";

const { ccclass, property } = _decorator;

@ccclass("GameManager")
export class GameManager extends Component {
  @property(Node)
  selectCharacterWindow: Node | null = null;
  @property(Node)
  gameWindow: Node | null = null;
  @property(Prefab)
  playerPrefab: Prefab | null = null;
  @property(Prefab)
  cardPrefab: Prefab | null = null;
  @property(Node)
  leftPlayerNodeList: Node | null = null;
  @property(Node)
  topPlayerNodeList: Node | null = null;
  @property(Node)
  rightPlayerNodeList: Node | null = null;
  @property(Node)
  deckText: Node | null = null;
  @property(Node)
  deckNode: Node | null = null;
  @property(Node)
  discardPileNode: Node | null = null;
  @property(Node)
  handCardUI: Node | null = null;
  @property(Node)
  cardGroupNode: Node | null = null;
  @property(Node)
  actionPlayerNode: Node | null = null;

  public identity: Identity;
  public playerCount: number;
  public selfPlayer: Player;
  public playerCharacterIdList: number[];
  public playerList: Player[];

  private _gamePhase: GamePhase;
  private _turnPlayerId: number;
  private _messageInTransmit: GameCard | null = null;
  private _deckCardCount: number;
  private _discardPile: Card[] = [];
  private _banishCards: Card[] = [];
  private _seq: number;
  private _handCardList: DataContainer<Card, CardUI>;
  private _cardGroupPool: DataContainer<GameCard, CardUI>[] = [];

  get gamePhase() {
    return this._gamePhase;
  }
  set gamePhase(phase: GamePhase) {
    if (phase == null || phase !== this._gamePhase) return;
    this._gamePhase = phase;
    EventTarget.emit(GameEvent.GAME_PHASE_CHANGE, phase);
  }

  get turnPlayerId() {
    return this._turnPlayerId;
  }
  set turnPlayerId(playerId: number) {
    if (playerId == null || playerId !== this._turnPlayerId) return;
    this._turnPlayerId = playerId;
    Player.turnPlayerId = playerId;
    EventTarget.emit(GameEvent.GAME_TURN_CHANGE, playerId);
  }

  get deckCardCount() {
    return this._deckCardCount;
  }
  set deckCardCount(count) {
    if (count == null || count === this._deckCardCount) return;
    this._deckCardCount = count;
    this.deckText.getChildByName("Label").getComponent(Label).string = "?????????????????????" + count;
  }

  onEnable() {
    this.gameWindow.active = false;

    //????????????
    EventTarget.on(ProcessEvent.START_SELECT_CHARACTER, (data: wait_for_select_role_toc) => {
      this.identity = createIdentity(
        (<unknown>data.identity) as IdentityType,
        (<unknown>data.secretTask) as SecretTaskType
      );
      this.playerCount = data.playerCount;
      this.playerCharacterIdList = data.roles;
      this.selectCharacterWindow.getComponent(SelectCharacter).init({
        identity: this.identity,
        roles: (<unknown[]>data.roles) as CharacterType[],
        waitingSecond: data.waitingSecond,
      });
    });

    //???????????????
    EventTarget.on(ProcessEvent.INIT_GAME, (data) => {
      this.selectCharacterWindow.getComponent(SelectCharacter).hide();
      this.gameWindow.active = true;
      this.init(data);

      //???????????????
      resources.preloadDir("images/cards");
    });

    //???????????????
    EventTarget.once(ProcessEvent.GET_PHASE_DATA, (data: notify_phase_toc) => {
      this.setPlayerSeats(data.currentPlayerId);
    });

    //??????phase??????
    EventTarget.on(ProcessEvent.GET_PHASE_DATA, (data: notify_phase_toc) => {
      EventTarget.emit(ProcessEvent.STOP_COUNT_DOWN);
      this.turnPlayerId = data.currentPlayerId;
      this.gamePhase = (<unknown>data.currentPhase) as GamePhase;
      if (data.waitingPlayerId === 0) {
        const progressStript = this.gameWindow.getChildByPath("Tooltip/Progress").getComponent(ProgressControl);
        progressStript.startCoundDown(data.waitingSecond);
      } else {
        this.playerList[data.waitingPlayerId].UI.startCoundDown(data.waitingSecond);
      }
      if (data.messagePlayerId) {
        this.sendMessage(this.playerList[data.waitingPlayerId], data.messageCard);
      }
      if (data.messageCard) {
        if (this._messageInTransmit instanceof UnknownCard) {
          const position = this._messageInTransmit.UI.node.worldPosition;
          this._messageInTransmit.UI.node.removeFromParent();
          const card = this.createMessage(data.messageCard) as Card;
          card.status = CardStatus.FACE_DOWN;
          this._messageInTransmit.UI.card = card;
          this._messageInTransmit = card;
          this._messageInTransmit.UI.node.setWorldPosition(position);
          this._messageInTransmit.UI.node.setParent(this.actionPlayerNode);
          this._messageInTransmit.flip();
        } else {
        }
      }

      if (data.seq) this._seq = data.seq;
      //data.senderId
    });

    //??????????????????
    EventTarget.on(ProcessEvent.SYNC_DECK_NUM, (data: sync_deck_num_toc) => {
      this.deckCardCount = data.num;
      if (data.shuffled) {
        //??????????????????????????????????????????
      }
    });

    //??????
    EventTarget.on(ProcessEvent.ADD_CARDS, (data: add_card_toc) => {
      this.drawCards(data);
    });

    //??????
    EventTarget.on(ProcessEvent.DISCARD_CARDS, (data: discard_card_toc) => {
      this.discardCards(data);
    });

    //??????????????????
    EventTarget.on(ProcessEvent.UPDATE_CHARACTER, (data: notify_role_update_toc) => {
      if (data.role) {
        if (this.playerList[data.playerId].character.id === 0) {
          const ui = this.playerList[data.playerId].character.UI;
          const character = createCharacterById((<unknown>data.role) as CharacterType, ui);
          this.playerList[data.playerId].character = character;
        }
        this.playerList[data.playerId].character.status = CharacterStatus.FACE_UP;
      } else {
        this.playerList[data.playerId].character.status = CharacterStatus.FACE_DOWN;
      }
    });

    //??????????????????
    EventTarget.on(ProcessEvent.SEND_MESSAGE, (data: send_message_card_toc) => {
      const player = this.playerList[data.senderId || data.playerId];
      if (data.cardId) {
        for (let item of player.handCards) {
          if (item instanceof Card && item.id === data.cardId) {
            this._messageInTransmit = item;
            this._messageInTransmit.UI.node.setParent(this.actionPlayerNode);
            tween(this._messageInTransmit.UI.node)
              .to(0.8, {
                worldPosition: player.UI.node.worldPosition,
                scale: new Vec3(0.6, 0.6, 1),
              })
              .start();
          }
        }
      } else {
        this.sendMessage(player);
      }
    });

    //????????????????????????
    EventTarget.on(ProcessEvent.CHOOSE_RECEIVE, (data: choose_receive_toc) => {});

    //????????????
    EventTarget.on(ProcessEvent.PLAYER_DYING, (data: notify_dying_toc) => {});

    //???????????????
    EventTarget.on(ProcessEvent.WAIT_FOR_CHENG_QING, (data: wait_for_cheng_qing_toc) => {});

    //????????????
    EventTarget.on(ProcessEvent.PLAYER_DIE, (data: notify_die_toc) => {});

    //????????????
    EventTarget.on(ProcessEvent.WAIT_FOR_DIE_GIVE_CARD, (data: wait_for_die_give_card_toc) => {});

    //????????????
    EventTarget.on(ProcessEvent.PLAYER_WIN, (data: notify_winner_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_SHI_TAN, (data: use_shi_tan_toc) => {});
    EventTarget.on(ProcessEvent.SHOW_SHI_TAN, (data: show_shi_tan_toc) => {});
    EventTarget.on(ProcessEvent.EXECUTE_SHI_TAN, (data: execute_shi_tan_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_PING_HENG, (data: use_ping_heng_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.WEI_BI_WAIT_FOR_GIVE_CARD, (data: wei_bi_wait_for_give_card_toc) => {});
    EventTarget.on(ProcessEvent.WEI_BI_SHOW_HAND_CARD, (data: wei_bi_show_hand_card_toc) => {});
    EventTarget.on(ProcessEvent.WEI_BI_GIVE_CARD, (data: wei_bi_give_card_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_CHENG_QING, (data: use_cheng_qing_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_PO_YI, (data: use_po_yi_toc) => {});
    EventTarget.on(ProcessEvent.PO_YI_SHOW_MESSAGE, (data: po_yi_show_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_JIE_HUO, (data: use_jie_huo_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_DIAO_BAO, (data: use_diao_bao_toc) => {});

    //??????
    EventTarget.on(ProcessEvent.USE_WU_DAO, (data: use_wu_dao_toc) => {});

    //????????????
    EventTarget.on(ProcessEvent.USE_FENG_YUN_BIAN_HUAN, (data: use_feng_yun_bian_huan_toc) => {});
    EventTarget.on(
      ProcessEvent.WAIT_FOR_FENG_YUN_BIAN_HUAN_CHOOSE_CARD,
      (data: wait_for_feng_yun_bian_huan_choose_card_toc) => {}
    );
    EventTarget.on(ProcessEvent.FENG_YUN_BIAN_HUAN_CHOOSE_CARD, (data: feng_yun_bian_huan_choose_card_toc) => {});
  }

  onDisable() {
    //??????????????????
    EventTarget.off(ProcessEvent.START_SELECT_CHARACTER);
    EventTarget.off(ProcessEvent.INIT_GAME);
    EventTarget.off(ProcessEvent.GET_PHASE_DATA);
    EventTarget.off(ProcessEvent.SYNC_DECK_NUM);
    EventTarget.off(ProcessEvent.ADD_CARDS);
    EventTarget.off(ProcessEvent.DISCARD_CARDS);
    EventTarget.off(ProcessEvent.UPDATE_CHARACTER);
    EventTarget.off(ProcessEvent.SEND_MESSAGE);
    EventTarget.off(ProcessEvent.CHOOSE_RECEIVE);
    EventTarget.off(ProcessEvent.PLAYER_DYING);
    EventTarget.off(ProcessEvent.WAIT_FOR_CHENG_QING);
    EventTarget.off(ProcessEvent.PLAYER_DIE);
    EventTarget.off(ProcessEvent.WAIT_FOR_DIE_GIVE_CARD);
    EventTarget.off(ProcessEvent.PLAYER_WIN);
    EventTarget.off(ProcessEvent.USE_SHI_TAN);
    EventTarget.off(ProcessEvent.SHOW_SHI_TAN);
    EventTarget.off(ProcessEvent.EXECUTE_SHI_TAN);
    EventTarget.off(ProcessEvent.USE_PING_HENG);
    EventTarget.off(ProcessEvent.WEI_BI_WAIT_FOR_GIVE_CARD);
    EventTarget.off(ProcessEvent.WEI_BI_SHOW_HAND_CARD);
    EventTarget.off(ProcessEvent.WEI_BI_GIVE_CARD);
    EventTarget.off(ProcessEvent.USE_CHENG_QING);
    EventTarget.off(ProcessEvent.USE_PO_YI);
    EventTarget.off(ProcessEvent.PO_YI_SHOW_MESSAGE);
    EventTarget.off(ProcessEvent.USE_JIE_HUO);
    EventTarget.off(ProcessEvent.USE_DIAO_BAO);
    EventTarget.off(ProcessEvent.USE_WU_DAO);
    EventTarget.off(ProcessEvent.USE_FENG_YUN_BIAN_HUAN);
    EventTarget.off(ProcessEvent.WAIT_FOR_FENG_YUN_BIAN_HUAN_CHOOSE_CARD);
    EventTarget.off(ProcessEvent.FENG_YUN_BIAN_HUAN_CHOOSE_CARD);
  }

  init(data: init_toc) {
    this.playerCount = data.playerCount;
    this.playerList = [];

    //????????????
    this.selfPlayer = new Player({
      id: 0,
      name: data.names[0],
      character: createCharacterById((<unknown>data.roles[0]) as CharacterType),
      UI: this.gameWindow.getChildByPath("Self/Player").getComponent(PlayerUI),
    });
    this.playerList.push(this.selfPlayer);
    this.identity = createIdentity(
      (<unknown>data.identity) as IdentityType,
      (<unknown>data.secretTask) as SecretTaskType
    );

    //?????????????????????
    this.gameWindow.getChildByPath("Tooltip/Progress").active = false;

    //???????????????UI
    this._handCardList = new HandCardList(this.handCardUI.getComponent(HandCardUI));

    //??????cardGroupPool
    this.initCardGroupPool();

    //???????????????
    for (let i = 1; i < data.playerCount; i++) {
      this.playerList.push(
        new Player({
          id: i,
          name: data.names[i],
          character: createCharacterById((<unknown>data.roles[i]) as CharacterType),
        })
      );
    }

    //???????????????UI
    const othersCount = data.playerCount - 1;
    const sideLength = Math.floor(othersCount / 3);

    for (let i = 0; i < sideLength; i++) {
      const player = instantiate(this.playerPrefab);
      this.rightPlayerNodeList.addChild(player);
      this.playerList[i + 1].UI = player.getComponent(PlayerUI);
    }

    for (let i = sideLength; i < othersCount - sideLength; i++) {
      const player = instantiate(this.playerPrefab);
      this.topPlayerNodeList.addChild(player);
      this.playerList[i + 1].UI = player.getComponent(PlayerUI);
    }

    for (let i = othersCount - sideLength; i < othersCount; i++) {
      const player = instantiate(this.playerPrefab);
      this.leftPlayerNodeList.addChild(player);
      this.playerList[i + 1].UI = player.getComponent(PlayerUI);
    }

    this.rightPlayerNodeList.getComponent(Layout).updateLayout();
    this.topPlayerNodeList.getComponent(Layout).updateLayout();
    this.leftPlayerNodeList.getComponent(Layout).updateLayout();
  }

  initCardGroupPool() {
    //?????????????????????cardGroup
    this._cardGroupPool.push(new CardGroup(this.cardGroupNode.getComponent(CardGroupNode)));
    for (let i = 1; i < this.playerCount; i++) {
      const group = new CardGroup(instantiate(this.cardGroupNode).getComponent(CardGroupNode));
      group.UI.node.setParent(this.actionPlayerNode);
      this._cardGroupPool.push(group);
    }
  }

  getCardGroup() {
    for (let i = 0; i < this._cardGroupPool.length; i++) {
      if (!(<CardGroupNode>this._cardGroupPool[i].UI).onAnimation) {
        this._cardGroupPool[i].removeAllData();
        return this._cardGroupPool[i];
      }
    }
    const cardGroup = new CardGroup(instantiate(this.cardGroupNode).getComponent(CardGroupNode));
    this._cardGroupPool.push(cardGroup);
    return cardGroup;
  }

  drawCards(data: add_card_toc) {
    const cardGroup = this.getCardGroup();
    const player = this.playerList[data.playerId];

    if (data.unknownCardCount) {
      for (let i = 0; i < data.unknownCardCount; i++) {
        const card = this.createHandCard();
        card.UI.node.scale = new Vec3(0.6, 0.6, 1);
        player.addCard(card);
        cardGroup.addData(card);
      }
    }
    if (data.cards && data.cards.length) {
      for (let item of data.cards) {
        const card = this.createHandCard(item);
        card.UI.node.scale = new Vec3(0.6, 0.6, 1);
        player.addCard(card);
        cardGroup.addData(card);
      }
    }

    //????????????
    (<CardGroupNode>cardGroup.UI).move(this.deckNode.worldPosition, player.UI.node.worldPosition, () => {
      if (data.playerId === 0) {
        for (let card of cardGroup.list) {
          card.UI.node.scale = new Vec3(1, 1, 1);
          this._handCardList.addData(card as Card);
        }
      }
    });
  }

  discardCards(data: discard_card_toc) {
    if (data.cards && data.cards.length) {
      const player = this.playerList[data.playerId];
      const cardIdList = data.cards.map((item) => item.id);
      const cards = player.discardCard(cardIdList);
      if (data.playerId === 0) {
        cards.forEach((card) => {
          card.UI.node.setParent(this.actionPlayerNode);
          tween(card.UI.node)
            .to(
              0.6,
              {
                scale: new Vec3(0.6, 0.6, 1),
                worldPosition: this.discardPileNode.worldPosition,
              },
              {
                onComplete: () => {
                  card.UI = null;
                },
              }
            )
            .start();
        });
      } else {
        const cardGroup = this.getCardGroup();
        cards.forEach((card) => {
          card.UI = instantiate(this.cardPrefab).getComponent(CardUI);
          card.UI.node.scale = new Vec3(0.6, 0.6, 1);
          cardGroup.addData(card);
        });
        (<CardGroupNode>cardGroup.UI).move(player.UI.node.worldPosition, this.discardPileNode.worldPosition, () => {
          cardGroup.list.forEach((item) => {
            item.UI = null;
          });
        });
      }
    }
  }

  selectCard() {}

  playCard(player, card) {}

  sendMessage(player: Player, card?: card) {
    const panting = player.UI.node.getChildByPath("Border/CharacterPanting");
    if (!this._messageInTransmit) {
      this._messageInTransmit = this.createMessage();
      this._messageInTransmit.UI.node.active = true;
      this._messageInTransmit.UI.node.setParent(this.actionPlayerNode);
      this._messageInTransmit.UI.node.setWorldPosition(panting.worldPosition);
      this._messageInTransmit.UI.node.scale = new Vec3(0.6, 0.6, 1);
    } else if (card && this._messageInTransmit instanceof UnknownCard) {
      console.log(1);
      const oldMessage = this._messageInTransmit;
      this._messageInTransmit = this.createMessage();
      this._messageInTransmit.UI = oldMessage.UI;
      tween(this._messageInTransmit.UI.node)
        .to(0.8, {
          worldPosition: panting.worldPosition,
        })
        .start();
    } else {
      tween(this._messageInTransmit.UI.node)
        .to(0.8, {
          worldPosition: panting.worldPosition,
        })
        .start();
    }
  }

  setPlayerSeats(fistPlayerId: number) {
    let i = fistPlayerId;
    let j = 0;
    do {
      this.playerList[i].seatNumber = j;
      i = (i + 1) % this.playerCount;
      ++j;
    } while (i !== fistPlayerId);
  }

  createHandCard(card?: card): GameCard {
    if (card) {
      return createCard({
        id: card.cardId,
        color: (<unknown>card.cardColor) as CardColor[],
        type: (<unknown>card.cardType) as CardType,
        direction: (<unknown>card.cardDir) as CardDirection,
        drawCardColor: (<unknown>card.whoDrawCard) as CardColor[],
        usage: CardUsage.HAND_CARD,
        lockable: card.canLock,
        UI: instantiate(this.cardPrefab).getComponent(CardUI),
      });
    } else {
      return createUnknownCard(instantiate(this.cardPrefab).getComponent(CardUI));
    }
  }

  createMessage(card?: card): GameCard {
    if (card) {
      return createCard({
        id: card.cardId,
        color: (<unknown>card.cardColor) as CardColor[],
        type: (<unknown>card.cardType) as CardType,
        direction: (<unknown>card.cardDir) as CardDirection,
        drawCardColor: (<unknown>card.whoDrawCard) as CardColor[],
        usage: CardUsage.MESSAGE_CARD,
        lockable: card.canLock,
        UI: instantiate(this.cardPrefab).getComponent(CardUI),
      });
    } else {
      return createUnknownCard(instantiate(this.cardPrefab).getComponent(CardUI));
    }
  }
}
