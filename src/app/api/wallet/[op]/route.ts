import type { NextRequest } from "next/server";
import type { TxMethod } from "@/lib/types";
import { freshSnapshot, handle, int, readJson, requireUser, str } from "@/server/http";
import { tpi } from "@/server/tpi";
import { TpiError } from "@/server/tpi/db";
import * as wallet from "@/server/tpi/wallet";

/** POST /api/wallet/<op>. Every change answers with the person's fresh snapshot. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/wallet/[op]">) {
  return handle(async () => {
    const { op } = await ctx.params;
    const user = await requireUser();
    const body = await readJson(req);
    const t = tpi();
    switch (op) {
      case "pay": {
        const { txn, activityId } = wallet.pay(t, user, {
          payeeHandle: str(body, "payeeHandle"),
          payeeName: str(body, "payeeName", true),
          amount: int(body, "amount"),
          note: str(body, "note", true),
          method: (str(body, "method", true) ?? "contact") as TxMethod,
          accountId: str(body, "accountId", true),
          pin: str(body, "pin"),
          requestId: str(body, "requestId", true),
          billId: str(body, "billId", true),
          idemKey: str(body, "idemKey", true),
        });
        return {
          payment: { txnId: txn.txn_id, rrn: txn.rrn, state: txn.state, failureCode: txn.failure_code, activityId },
          snapshot: freshSnapshot(user),
        };
      }
      case "topup": {
        const activityId = wallet.topUp(t, user, { amount: int(body, "amount"), accountId: str(body, "accountId", true), pin: str(body, "pin") });
        return { activityId, snapshot: freshSnapshot(user) };
      }
      case "self-transfer": {
        const activityId = wallet.selfTransfer(t, user, {
          fromId: str(body, "fromId"),
          toId: str(body, "toId"),
          amount: int(body, "amount"),
          pin: str(body, "pin"),
        });
        return { activityId, snapshot: freshSnapshot(user) };
      }
      case "request": {
        const messageId = wallet.requestMoney(t, user, { fromHandle: str(body, "fromHandle"), amount: int(body, "amount"), note: str(body, "note", true) });
        return { messageId, snapshot: freshSnapshot(user) };
      }
      case "respond": {
        const action = str(body, "action");
        if (action !== "decline" && action !== "cancel") throw new TpiError("BAD_REQUEST");
        wallet.respondRequest(t, user, { messageId: str(body, "messageId"), action });
        break;
      }
      case "message":
        wallet.sendMessage(t, user, { toHandle: str(body, "toHandle"), text: str(body, "text") });
        break;
      case "scratch":
        wallet.scratchReward(t, user, str(body, "rewardId"));
        break;
      case "add-account":
        wallet.addAccount(t, user);
        break;
      case "set-primary":
        wallet.setPrimary(t, user, str(body, "accountId"));
        break;
      case "add-card":
        wallet.addCard(t, user);
        break;
      case "link-bill": {
        const billId = wallet.linkBill(t, user, {
          categoryId: str(body, "categoryId"),
          providerId: str(body, "providerId"),
          accountNumber: str(body, "accountNumber"),
          label: str(body, "label", true),
        });
        return { billId, snapshot: freshSnapshot(user) };
      }
      case "resolve":
        return { contact: wallet.resolve(t, user, { handle: str(body, "handle", true), phone: str(body, "phone", true), name: str(body, "name", true) }) };
      default:
        throw new TpiError("NOT_FOUND", 404);
    }
    return { snapshot: freshSnapshot(user) };
  });
}
