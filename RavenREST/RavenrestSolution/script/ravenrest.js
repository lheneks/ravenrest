/*
 * A Javascript client for RavenDB HTTP API
 * Version 1.0 Copyright (C) E. Fernando Ruiz, 2012
 * Any contributions and feedback are greately appreciated.
 * Distributed under the MIT License. More information on project website.
 * Project website: http://code.google.com/p/ravenrest/
*/

// AJAX Callback response object
function Response() {
    var instance =
    {
        error: false,
        code: "",
        msg: "",
        dbmsg: "",
        key: "",
        data: {}
    };
    return instance;
}


// Query Object
function Query(database) {

    var from, by, where, select, equals, is, success, error, index, orderby;
    var conditions = [];
    var searchedfields = [];
    var innerQuery;
    var cached, cacheid, cachedResults, invalidatedCache;

    var db = database;
    var errormsg;

    var fn_from = function (query) {
        if (!query)
            return from;

        from = query;
        invalidatedCache = true;
        return this;
    }

    var fn_orderby = function (query) {
        orderby = query;
        invalidatedCache = true;
        return this;
    }

    var fn_orderbydesc = function (query) {
        return fn_orderby("-" + query);
    }

    var fn_cached = function (value) {
        if (value == undefined)
            return cached;
        else
            cached = value;
    }

    var fn_cacheid = function (value) {
        if (value == undefined) {
            return cacheid;
        }
        else {
            cacheid = value;
            invalidatedCache = false;
        }
    }

    var fn_equals = function (query) {
        if (where)
            conditions.push(where + ":\"" + query + "\" ");

        where = undefined; //reset
        invalidatedCache = true;
        return this;
    }

    var fn_notequals = function (query) {
        if (where)
            conditions.push(" -" + where + ":\"" + query + "\" ");

        where = undefined; //reset
        invalidatedCache = true;
        return this;
    }

    var fn_and = function (query) {
        where = " AND " + query;
        invalidatedCache = true;
        return this;
    }

    var fn_or = function (query) {
        where = " OR " + query;
        invalidatedCache = true;
        return this;
    }

    var fn_starts = function (query) {
        if (where)
            conditions.push(where + ": *" + query + " ");

        where = undefined; //reset
        invalidatedCache = true;
        return this;
    }

    var fn_ends = function (query) {
        if (where)
            conditions.push(where + ":" + query + "* ");

        where = undefined; //reset
        invalidatedCache = true;
        return this;
    }

    var fn_contains = function (query) {
        if (where)
            conditions.push(where + ": *" + query + "* ");

        where = undefined; //reset
        invalidatedCache = true;
        return this;
    }

    var fn_where = function (query) {
        where = query;
        if (!(query in searchedfields)) {
            searchedfields.push(query);
            searchedfields.sort();
        }

        invalidatedCache = true;
        return this;
    }

    var fn_index = function (indexfield, indexvalue) {
        if (!indexfield)
            return index;

        is = indexvalue;
        by = indexfield;
        invalidatedCache = true;
        return this;
    }

    var fn_error = function (callback) {
        if (callback == undefined)
            return error;
        else
            error = callback;
        invalidatedCache = true;
        return this;
    }

    var fn_success = function (callback) {
        if (callback == undefined)
            return success;
        else
            success = callback;
        invalidatedCache = true;
        return this;
    }

    var fn_select = function (cache) {
        cached = cache & !invalidatedCache;
        var index = getIndex();
        if (!innerQuery || invalidatedCache)
            innerQuery = BuildLuceneQueryString();
        db.Select(this);
        invalidatedCache = false;
        return this;
    }

    var fn_fetch = function (field, cache) {
        cached = cache;
        var index = getIndex();
        if (!innerQuery) {
            innerQuery = BuildLuceneQueryString();
            innerQuery += "&fetch=" + field;
        }
        db.Select(this);
        return this;
    }

    // Try to use pre-defined index; if not exists, use dynamic index instead
    function getIndex() {
        if (index)
            return index;

        if (from && by && searchedfields && conditions && is && success) {
            index = "ndx_for(" + by + "_is_" + is + ")_on_" + searchedfields.join();
        } else if (from && searchedfields && conditions && success) {
            index = "ndx_all_on_" + where;
        }

        if (index) {
            if (!database.HasIndex(index)) {
            // use dynamic index, and prepend static index constraint as query condition
                errormsg = "No such index: " + index;
                index = "dynamic";
                if (by && is)
                    conditions.unshift(by + ":\"" + is + "\" AND ");
            }
        }

        return index;
    }

    function BuildLuceneQueryString() {
        var query = "";
        for (c in conditions) {
            query += conditions[c];
        }

        query= encodeURIComponent(query);

        if (orderby)
            query += "&sort=" + orderby;

        return query;
    }

    /*               
    Query pattern example: 
                     
    var q = Query()
    .From("Products")
    .Index("Type","Chair")
    .Where("Model").Equals("Accord")
    .OrderBy("PartNumber")
    .Success(...).Error(...)
    .Select()
    */

    var queryobject = {

        From: fn_from,
        Index: fn_index,

        Cached: fn_cached,
        CacheID: fn_cacheid,
        InnerQuery: function () { return innerQuery; },

        And: fn_and,
        Or: fn_or,
        Where: fn_where,

        Equals: fn_equals,
        Not: fn_notequals,
        StartsWith: fn_starts,
        EndsWith: fn_ends,
        Contains: fn_contains,

        Select: fn_select,
        Fetch: fn_fetch,

        OrderBy: fn_orderby,
        OrderByDesc: fn_orderbydesc,

        Success: fn_success,
        Error: fn_error,
        ErrorMsg: errormsg
    };

    return queryobject;
    }








    // Database Adapter 
    function DBAdapter(dburl, databasename) {

        var server = dburl;
        var defaultdatabase = databasename;
        var db;
        var cache = [];
        var indexes = [];

        var use = function (databasename) {
            if (databasename) {
                db = server + "/databases/" + databasename;
            }
            else
                db = server;
        }

        // set active Database
        use(databasename);

    /* Insert a new documents
    D: dababase name, O: query as string, S= Success callback, E= Error callback
    */
        var insert = function (d, o, s, e) {

            var newid = GUID();
            use(d);

            // asynchronous request
            $.ajax({
                url: db + "/docs/" + newid,
                type: "PUT",
                data: JSON.stringify(o),
                contentType: 'text/plain',
                error: function (data, msg, response) {
                    var resp = Response();
                    resp.code = response.status;
                    resp.key = data.Key;
                    resp.msg = response.responseText;
                    e(resp);
                },
                success: function (data, msg, response) {
                    var resp = Response();
                    resp.code = response.status;
                    resp.dbmsg = response.status == 201 ? "Inserted" : "Not inserted";
                    resp.error = response.status == 201 ? false : true;
                    resp.key = data.Key;
                    resp.msg = response.responseText;
                    s(resp);
                }
            });

        }


    /* Get document(s) by GUID.
      D: database name,  O: Document GUID as string, or multiple as string[], S= Success callback, E= Error callback
    */
        var get = function (d, o, s, e) {
            use(d);
            if ($.isArray(o)) {

                $.ajax({
                    type: "POST",
                    url: db + "/queries",
                    data: o,
                    error: e,
                    success: s
                });
            }
            else {
                $.ajax({
                    type: "GET",
                    url: db + "/docs/" + o,
                    error: e,
                    success: s
                });
            }
        }


    /* Hard delete a document
    O: Document GUID as string, S= Success callback, E= Error callback
    */
        var delete_ = function (d, o, s, e) {
            use(d);
            $.ajax({
                type: "DELETE",
                url: db + "/docs/" + o,
                error: e,
                success: s
            });
        }

    function BuildLuceneQueryString(whereKey, whereValue) {
        return encodeURIComponent(whereKey + ":\"" + whereValue + "\"");
    }


    /* 
        Select indexed documents.
    */
    var select = function (query) {
        use(query.From());

        // try return cached version
        if (query.Cached() && query.CacheID()) {
           query.Success()(cache[query.CacheID()]);
            return;
        }

        $.ajax({
            type: "GET",
            url: db + "/indexes/" + query.Index(),
            data: "query=" + query.InnerQuery(),
            error: query.Error,
            success: function (data) {
                // save results to cache
                if (query.Cached()) {
                    var cacheid = GUID();
                    query.CacheID(cacheid);
                    cache[cacheid]=data;
                }
                //execute callback
                query.Success()(data);
            }
        });
    }


    /* Index all documents in DB by a given key
    indexByKey= [] document KEY(s) by to use as index, S= Success callback, E= Error callback
    */
    var index = function (indexByKey, s, e) {

        var cmd = "{ Map:'from doc in docs select new { *** }'}";
        if (!$.isArray(indexByKey))
            indexByKey = [indexByKey];

        var index = "";
        var name = "";
        for (ind in indexByKey) {
            indexByKey[ind] = indexByKey[ind].replace(/^\s+|\s+$/g, '');
            index += "doc." + indexByKey[ind] + ",";
            name += indexByKey[ind] + ",";
        }
        index = index.substring(0, index.length - 1);
        name = name.substring(0, name.length - 1);
        cmd = cmd.replace("***", index);

        var indexName = "ndx_all_on_" + name;
        submitindex(indexName, cmd, s, e);
    }


    /* Index selected documents that match a condition in DB by a given key
    whereKey= condition key, whereValue=condition, indexByKey= [] document KEY(s) by to use as index,
    S= Success callback, E= Error callback
    */
    var indexwhere = function (whereKey, whereValue, indexByKey, s, e) {
        if (!$.isArray(indexByKey))
            indexByKey = [indexByKey];

        indexByKey.sort();

        whereKey = whereKey.replace(/^\s+|\s+$/g, '');
        whereValue = whereValue.replace(/^\s+|\s+$/g, '');

        var cmd = "{ Map:'from doc in docs where doc.whereKey==\"whereValue\" select new { *** }'}";
        cmd = cmd.replace("whereKey", whereKey).replace("whereValue", whereValue);

        var index = "";
        var name = "";
        for (ind in indexByKey) {
            indexByKey[ind] = indexByKey[ind].replace(/^\s+|\s+$/g, '');
            index += "doc." + indexByKey[ind] + ",";
            name += indexByKey[ind] + ",";
        }
        index = index.substring(0, index.length - 1);
        name = name.substring(0, name.length - 1);
        cmd = cmd.replace("***", index);

        var indexName = "ndx_for(" + whereKey + "_is_" + whereValue + ")_on_" + name;
        submitindex(indexName, cmd, s, e);
    }


    // submits index creation command
    var submitindex = function (indexName, cmd, s, e) {
        // asynchronous request
        $.ajax({
            url: db + "/indexes/" + indexName,
            type: "PUT",
            data: cmd,
            contentType: 'text/plain',
            error: function (data, msg, response) {
                var resp = Response();
                resp.code = response.status;
                resp.key = data.Key;
                resp.msg = response.responseText;
                e(resp);
            },
            success: function (data, msg, response) {
                var resp = Response();
                resp.code = response.status;
                resp.dbmsg = response.status == 201 ? "Index Created" : "Index Not Created";
                resp.error = response.status == 201 ? false : true;
                resp.key = data.Key;
                resp.msg = response.responseText;
                updateIndexList(); // update local index list
                s(resp);
            }
        });
    }

    var updateIndexList = function () {
        $.ajax({
            type: "GET",
            url: db + "/indexes",
            success: function (data) {
                indexes = data;
                for (ind in indexes) {
                    var keystring = indexes[ind].name.split("_on_")[1];
                    if (keystring) {
                        var keys = keystring.split(",");
                        keys.sort();
                        indexes[ind].keys = keys;
                    }
                }
            }
        });
    }

    var hasIndex = function (indexname) {
        var exists = false;
        for (i in indexes) {
            if (indexes[i] && indexes[i].name == indexname)
                exists = true;
        }
        return exists;
    }

    // Global Unique Identifier
    function GUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
        });
        return uuid;
    }


    // Initialize DB Cache
    updateIndexList();


    // Instance of this
    var r =
    {
        Use: use,
        Delete: delete_,
        Insert: insert,
        Get: get,
        Select: select,
        IndexWhere: indexwhere,
        Index: index,
        Indexes: indexes,
        HasIndex: hasIndex,
        UpdateIndexList: updateIndexList
    };

    return r;
}

