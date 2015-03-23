An experimental, unfinished Javascript client for RavenDB HTTP API. The goal is the abstraction of most common DB operations for fast development using RavenDB.

Usage example:

```

// Connection
var database = DBAdapter("http://localhost:8080", "Products");

// Query
var q = Query(database)
    .From("Products")
    .Where("Brand").Equals("Ford")
    .Success( /*callback*/)
    .Error( /*callback*/)
    .Select();

// Insertion
database.Insert(
     "Products", 
      {
         Brand: "Ford",
         Model: "T",
         Year: "1937"
      },
     /*success callback*/,
     /*error callback*/
     );

```