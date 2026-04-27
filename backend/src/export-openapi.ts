import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { AppModule } from "./app.module";

async function exportSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");

  const config = new DocumentBuilder()
    .setTitle("CarbonLedger API")
    .setDescription(
      "Verified carbon credits. Permanent retirement. Full provenance.\n\n" +
      "## CarbonError codes\n" +
      "| Code | Name |\n" +
      "|------|------|\n" +
      "| 1  | ProjectNotFound |\n" +
      "| 2  | ProjectNotVerified |\n" +
      "| 3  | ProjectSuspended |\n" +
      "| 4  | InsufficientCredits |\n" +
      "| 5  | AlreadyRetired |\n" +
      "| 6  | SerialNumberConflict |\n" +
      "| 7  | UnauthorizedVerifier |\n" +
      "| 8  | UnauthorizedOracle |\n" +
      "| 9  | InvalidVintageYear |\n" +
      "| 10 | ListingNotFound |\n" +
      "| 11 | InsufficientLiquidity |\n" +
      "| 12 | PriceNotSet |\n" +
      "| 13 | MonitoringDataStale |\n" +
      "| 14 | DoubleCountingDetected |\n" +
      "| 15 | RetirementIrreversible |\n" +
      "| 16 | ZeroAmountNotAllowed |\n" +
      "| 17 | ProjectAlreadyExists |\n" +
      "| 18 | InvalidSerialRange |"
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = resolve(__dirname, "../docs/openapi.json");
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}
exportSpec();
