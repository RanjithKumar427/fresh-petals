CREATE INDEX "idx_categories_image_id" ON "categories" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "idx_product_images_media_id" ON "product_images" USING btree ("media_id");