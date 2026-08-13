/// <reference path="../pb_data/types.d.ts" />
// After a sale_item is created, decrement stock for each ingredient in the
// product's recipe (BOM). For each recipe_item found:
//   decrement = sale_item.quantity * recipe_item.quantity
// Each ingredient is updated independently; if one fails, the loop continues
// with the remaining ones. The sale_item itself is never blocked.
onRecordAfterCreateSuccess((e) => {
  try {
    const record = e.record
    const productId = record.getString('productId')
    const saleQty = record.getFloat('quantity')

    if (!productId || saleQty <= 0) {
      e.next()
      return
    }

    // Find the full bill of materials for this product.
    const recipeItems = $app.findRecordsByFilter(
      'recipe_items',
      'productId = {:productId}',
      '',
      1000,
      0,
      { productId: productId },
    )

    for (let i = 0; i < recipeItems.length; i++) {
      const recipeItem = recipeItems[i]
      const ingredientId = recipeItem.getString('ingredientId')
      const recipeQty = recipeItem.getFloat('quantity')

      if (!ingredientId || recipeQty <= 0) {
        continue
      }

      try {
        const ingredient = $app.findRecordById('ingredients', ingredientId)
        if (!ingredient) {
          continue
        }

        const decrement = saleQty * recipeQty
        const current = ingredient.getFloat('currentStock')
        let next = current - decrement
        if (next < 0) {
          next = 0
        }
        ingredient.set('currentStock', next)
        $app.save(ingredient)

        // Low-stock detection is handled by the frontend (it queries for
        // currentStock <= minStock). Nothing more to do server-side.
      } catch (ingErr) {
        console.log('on_sale_item_create: failed to update ingredient', ingredientId, ':', ingErr)
      }
    }
  } catch (err) {
    console.log('on_sale_item_create: failed to process BOM:', err)
  }
  e.next()
}, 'sale_items')
