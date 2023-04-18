# Godspeed Micro-service Framework & Platform

> 4th Generation Declarative Microservice Framework and Platform

  Ace your microservices development and ops: Build and scale backends like a charm, with lower maintenance, costs, hurdles, risks, and higher productivity.


## Problem Statement

- Create a API backend for a restaurant app, using [Godspeed Framework](https://docs.godspeed.systems/docs/preface).
  - which has below REST API's:
    <table border="1">
      <thead>
        <tr>
          <td>Method</td>
          <td>URL</td>
          <td>Description</td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>GET</td>
          <td>/reataurant/:restaurantId</td>
          <td>Fetch a restaurant by restaurantId</td>
        </tr>
        <tr>
          <td>POST</td>
          <td>/reataurant</td>
          <td>Createa a new restaurant</td>
        </tr>
        <tr>
          <td>PUT</td>
          <td>/reataurant</td>
          <td>Update an existing restaurant</td>
        </tr>
        <tr>
          <td>DELETE</td>
          <td>/restaurant/:restaurantId</td>
          <td>Delete an existing restaurant</td>
        </tr>
        <tr>
          <td>POST</td>
          <td>/restaurant/search</td>
          <td>Fetch restaurants of a particular city, and have Menu Items also in the response, If `couponCode` is provided, it should filter only those menu items which are for that code.</td>
        </tr>
      </tbody>
    </table>

  - Populate database with atleast 5 restaurants
  - Some coupon codes are `HUNGRY25`, `HUNGRY50`

Here is [Prisma](https://www.prisma.io/docs/getting-started) `schema.prisma` file for the above app. If you want you can use it as it is, or can modify. It is only for reference.

```javascript
generator client {
  provider = "prisma-client-js"
  output   = "./generated-clients/postgres"
  previewFeatures = ["metrics"]
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}

model Owner {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  name    String?
}

model Restaurant {
  id         Int        @id @default(autoincrement())
  createdAt  DateTime   @default(now())
  name      String
  since  DateTime
  isOpen  Boolean    @default(false)
  opsStartTime DateTime
  opsEndTime DateTime
  ownerId   Int?
  slug     String    @unique
  description String?
  location String
  menuItems MenuItems[]
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String
}

model MenuItems {
  id  Int @id @default(autoincrement())
  name String
  description String?
  price Int
  couponCode String[]
  restaurant Restaurant @relation(fields: [restaurantId], references: id)
  restaurantId  Int
}

model Order {
  id Int @id @default(autoincrement())
  frmoRestaurant Int
  orderStatus OrderStatus @default(NOT_INITIATED)
  placedAt DateTime?
  fulfilledAt DateTime?
  orderItems OrderItem[]
}

model OrderItem {
  id Int @id @default(autoincrement())
  menuItemId Int
  quantity Int
  order Order @relation(fields: [orderId], references: id)
  orderId Int
}

enum OrderStatus {
  INITIATED
  NOT_INITIATED
  WAITING_FOR_APPROVAL_FROM_RESTAURANT
  WAITING_FOR_DELIVERY_PARTNER
  PLACED
  PICKUP_BY_DELIVERY_PARTNER
  DELIVERED
  READY_TO_PICKUP
}
```

## Evaluation
  Your solution will be only evaluated if,
  1. You follow the GodspeedSystems github org. [link](https://github.com/godspeedsystems)
  2. You have starred, *gs-node-service* repository of Godspeed. [link](https://github.com/godspeedsystems/gs-node-service)
  3. Your code is hosted in a public repository.

## References
1. [Getting started guide](https://docs.godspeed.systems/docs/microservices/setup/getting-started)
2. [Documentation](https://docs.godspeed.systems/docs/preface)
3. Demo video of the godspeed framework [part one](https://www.youtube.com/watch?v=eEfqTAPAVlY), [part two](https://www.youtube.com/watch?v=4CiOBULwkAU).