import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  JwtAuthGuard,
  MinRole,
  RolesGuard,
} from "@workspace/auth-guard";
import type {
  JikanSuggestion,
  MangaView,
  Paginated,
} from "@workspace/contracts";
import { Roles } from "@workspace/contracts";
import { JikanService } from "../jikan/jikan.service";
import {
  CreateMangaDto,
  JikanSearchQuery,
  ListMangaQuery,
  UpdateMangaDto,
  UpdateStockDto,
} from "./dto";
import { MangaService } from "./manga.service";

/**
 * Catalog HTTP boundary. Mounted at `/catalog` so the thin gateway can route
 * `/catalog/*` straight through without rewriting paths (ADR-0011). Reads are
 * Guest-accessible (browsing needs no token); writes are role-gated per ADR-0005
 * — add/edit/stock require `@MinRole('moderator')`, delete requires
 * `@MinRole('admin')` (delete is an Admin ability per the PRD, and admin passes
 * every moderator check via the hierarchy).
 */
@Controller("catalog")
export class MangaController {
  constructor(
    private readonly manga: MangaService,
    private readonly jikan: JikanService,
  ) {}

  @Get("manga")
  list(@Query() query: ListMangaQuery): Promise<Paginated<MangaView>> {
    return this.manga.list({
      page: query.page,
      limit: query.limit,
      q: query.q,
      genres: query.genre,
      featured: query.featured,
    });
  }

  /** Distinct genres across the catalog, for the filter UI. */
  @Get("genres")
  genres(): Promise<string[]> {
    return this.manga.genres();
  }

  /**
   * Jikan search for add-time prefill (ADR-0009). Moderator-gated. Returns an
   * empty list when Jikan is unavailable so the UI falls back to manual entry.
   */
  @Get("jikan/search")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole(Roles.Moderator)
  searchJikan(@Query() query: JikanSearchQuery): Promise<JikanSuggestion[]> {
    return this.jikan.search(query.q);
  }

  @Get("manga/:id")
  async detail(@Param("id") id: string): Promise<MangaView> {
    const manga = await this.manga.findById(id);
    if (!manga) throw new NotFoundException("Manga not found");
    return manga;
  }

  /** Adds a manga (Jikan-prefilled or manual). Moderator-gated. */
  @Post("manga")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole(Roles.Moderator)
  create(@Body() dto: CreateMangaDto): Promise<MangaView> {
    return this.manga.create(dto);
  }

  /** Edits a manga's data/price. Moderator-gated; never resynced from Jikan. */
  @Patch("manga/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole(Roles.Moderator)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateMangaDto,
  ): Promise<MangaView> {
    const updated = await this.manga.update(id, dto);
    if (!updated) throw new NotFoundException("Manga not found");
    return updated;
  }

  /** Updates a manga's stock `quantity`. Moderator-gated. */
  @Patch("manga/:id/stock")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole(Roles.Moderator)
  async updateStock(
    @Param("id") id: string,
    @Body() dto: UpdateStockDto,
  ): Promise<MangaView> {
    const updated = await this.manga.updateStock(id, dto.quantity);
    if (!updated) throw new NotFoundException("Manga not found");
    return updated;
  }

  /** Deletes a manga. Admin-gated (an Admin ability per the PRD). */
  @Delete("manga/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MinRole(Roles.Admin)
  async remove(@Param("id") id: string): Promise<void> {
    const deleted = await this.manga.remove(id);
    if (!deleted) throw new NotFoundException("Manga not found");
  }
}
