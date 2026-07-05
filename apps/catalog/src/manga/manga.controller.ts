import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import type { MangaView, Paginated } from "@workspace/contracts";
import { ListMangaQuery } from "./dto";
import { MangaService } from "./manga.service";

/**
 * Catalog HTTP boundary. Mounted at `/catalog` so the thin gateway can route
 * `/catalog/*` straight through without rewriting paths (ADR-0011). All routes
 * are Guest-accessible — browsing needs no token.
 */
@Controller("catalog")
export class MangaController {
  constructor(private readonly manga: MangaService) {}

  @Get("manga")
  list(@Query() query: ListMangaQuery): Promise<Paginated<MangaView>> {
    return this.manga.list({
      page: query.page,
      limit: query.limit,
      q: query.q,
      genres: query.genre,
    });
  }

  /** Distinct genres across the catalog, for the filter UI. */
  @Get("genres")
  genres(): Promise<string[]> {
    return this.manga.genres();
  }

  @Get("manga/:id")
  async detail(@Param("id") id: string): Promise<MangaView> {
    const manga = await this.manga.findById(id);
    if (!manga) throw new NotFoundException("Manga not found");
    return manga;
  }
}
