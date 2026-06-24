import { Controller, Get } from "@nestjs/common";
import { SETTLEMENT_CURRENCY } from "@workspace/contracts";

const SERVICE = "payments";

@Controller()
export class AppController {
  @Get("health")
  health(): { status: "ok"; service: string } {
    return { status: "ok", service: SERVICE };
  }

  @Get()
  info(): { service: string; settlementCurrency: string } {
    return { service: SERVICE, settlementCurrency: SETTLEMENT_CURRENCY };
  }
}
