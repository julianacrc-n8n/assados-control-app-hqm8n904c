/// <reference path="../pb_data/types.d.ts" />
// Creates the 7 app collections for Assados Control and tightens the
// built-in `users` auth collection access rules.
// `users` (auth) already exists with default system rules; here we override
// its API rules to match the spec (view/update = own record, list/delete =
// locked, create = public).

migrate(
  (app) => {
    // --- users (auth) — update access rules only ---
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = null // Locked
    users.viewRule = 'id = @request.auth.id'
    users.createRule = '' // Public
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = null // Locked
    app.save(users)

    // --- products ---
    const products = new Collection({
      name: 'products',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, max: 200 },
        { name: 'barcode', type: 'text', required: false, max: 100 },
        { name: 'price', type: 'number', required: true, min: 0 },
        { name: 'description', type: 'text', required: false },
        { name: 'active', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(products)

    // --- ingredients ---
    const ingredients = new Collection({
      name: 'ingredients',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, max: 200 },
        {
          name: 'unit',
          type: 'select',
          required: true,
          values: ['kg', 'g', 'L', 'mL', 'unidade'],
          maxSelect: 1,
        },
        { name: 'currentStock', type: 'number', required: true, min: 0 },
        { name: 'minStock', type: 'number', required: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(ingredients)

    // --- recipe_items ---
    const recipeItems = new Collection({
      name: 'recipe_items',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'productId',
          type: 'relation',
          required: true,
          collectionId: products.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'ingredientId',
          type: 'relation',
          required: true,
          collectionId: ingredients.id,
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number', required: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(recipeItems)

    // --- purchases ---
    const purchases = new Collection({
      name: 'purchases',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'supplier', type: 'text', required: false, max: 200 },
        { name: 'total', type: 'number', required: true, min: 0 },
        { name: 'date', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(purchases)

    // --- purchase_items ---
    const purchaseItems = new Collection({
      name: 'purchase_items',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'purchaseId',
          type: 'relation',
          required: true,
          collectionId: purchases.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'ingredientId',
          type: 'relation',
          required: true,
          collectionId: ingredients.id,
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number', required: true, min: 0 },
        { name: 'unitCost', type: 'number', required: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(purchaseItems)

    // --- sales ---
    const sales = new Collection({
      name: 'sales',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'total', type: 'number', required: true, min: 0 },
        {
          name: 'paymentMethod',
          type: 'select',
          required: true,
          values: ['dinheiro', 'cartao', 'pix'],
          maxSelect: 1,
        },
        { name: 'amountPaid', type: 'number', required: false, min: 0 },
        { name: 'change', type: 'number', required: false, min: 0 },
        { name: 'date', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(sales)

    // --- sale_items ---
    const saleItems = new Collection({
      name: 'sale_items',
      type: 'base',
      listRule: '@request.auth.id != "" && userId = @request.auth.id',
      viewRule: '@request.auth.id != "" && userId = @request.auth.id',
      createRule: '@request.auth.id != "" && userId = @request.auth.id',
      updateRule: '@request.auth.id != "" && userId = @request.auth.id',
      deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
      fields: [
        {
          name: 'userId',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'saleId',
          type: 'relation',
          required: true,
          collectionId: sales.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'productId',
          type: 'relation',
          required: true,
          collectionId: products.id,
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', type: 'number', required: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(saleItems)
  },
  (app) => {
    // Best-effort revert: delete in reverse dependency order.
    const names = [
      'sale_items',
      'sales',
      'purchase_items',
      'purchases',
      'recipe_items',
      'ingredients',
      'products',
    ]
    for (const name of names) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {
        /* ignore */
      }
    }
    // Restore default users rules (public read/write is the PocketBase default).
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      users.listRule = 'id = @request.auth.id'
      users.viewRule = 'id = @request.auth.id'
      users.createRule = ''
      users.updateRule = 'id = @request.auth.id'
      users.deleteRule = 'id = @request.auth.id'
      app.save(users)
    } catch (_) {
      /* ignore */
    }
  },
)
