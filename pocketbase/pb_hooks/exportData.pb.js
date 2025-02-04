/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/litechat/users/export/{userid}", (e) => {
    let userid = e.request.pathValue("userid");

    if (e.auth.id !== userid) {
        return e.json(403, {
            status: 403,
            message: "Only the owner of the account can export the data.",
            dog: "https://http.dog/403"
        });
    }

    let chats = $app.findRecordsByFilter(
        "chats",
        "members.id ?~ {:uid}",
        "created",
        0,
        0,
        { uid: userid }
    );

    // Use an object to mimic a JavaScript set
    let members = {};

    chats.forEach((chat) => {
        chat.get("members").forEach((member) => {
            members[member] = true;
        });
    });

    let relatedPeople = $app.findRecordsByIds("users", Object.keys(members));

    let messages = $app.findRecordsByFilter(
        "messages",
        "chat.members.id ?~ {:uid}",
        "created",
        0,
        0,
        { uid: userid }
    );

    return e.json(200, {
        chats,
        relatedPeople,
        messages
    });
}, $apis.requireAuth());
