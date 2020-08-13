const router = require('express').Router();
const wwr = require("../models/wwr");
const wm = require("../models/wm");
const wmpending = require("../models/wmpending");
const { getPermissions } = require('../utils/utils');
const Discord = require("discord.js");
const DiscordUser = require("../models/DiscordUser");
const fetch = require("node-fetch");
const bans = require("../models/appeals");
const utils = require('../utils/utils');

async function isAuthorized(req, res, next) {
  if (req.user) {
    const guilds = await utils.getUserGuilds(req.user.discordId);
    if (guilds.find(e => e.id === "402555684849451028")) {
      next();
    } else {
      res.status(403).send("You must be on the Wow Wow Discord server before viewing this category.")
    }
  }
  else {
    res.redirect('/');
  }
}

async function isAuthorizedAdmin(req, res, next) {
  if (req.user) {
    await new Promise((s, r) => setTimeout(s, 1200));
    const guilds = await utils.getUserGuilds(req.user.discordId);
    const guild = guilds.find(e => e.id === "402555684849451028")
    if (guild) {
      const permissions = utils.getPermissions(guild.permissions);
      if (!permissions.get("ADMINISTRATOR")) return res.status(403).send("You must be an administrator of Wow Wow Discord to view this page.")
      next();
    } else {
      res.status(403).send("You must be on the Wow Wow Discord server before viewing this category.")
    }
  }
  else {
    res.redirect('/');
  }
}

async function isAuthorizedVerified(req, res, next) {
  if (req.user) {
    const guilds = await utils.getUserGuilds(req.user.discordId);
    const guild = guilds.find(e => e.id === "402555684849451028")
    if (guild) {
      const permissions = utils.getPermissions(guild.permissions);
      if (!permissions.get("ATTACH_FILES")) return res.status(403).send("You must be an administrator of Wow Wow Discord to view this page.")
      next();
    } else {
      res.status(403).send("You must be on the Wow Wow Discord server before viewing this category.")
    }
  }
  else {
    res.redirect('/');
  }
}

router.get('/', async (req, res) => {
  if (req.user) {
    const guilds = await utils.getUserGuilds(req.user.discordId);
    const guild = guilds.find(e => e.id === "402555684849451028");
    if (guild) {
      const perms = getPermissions(guild.permissions);
      if (perms.has("ATTACH_FILES")) {
        res.render("wwd", {
          username: req.user.username,
          inserver: true,
          logged: true,
          verified: true
        });
      } else {
        res.render("wwd", {
          username: req.user.username,
          inserver: true,
          logged: true,
          verified: false
        });
      }
    } else {
      res.render("wwd", {
        username: req.user.username,
        inserver: false,
        logged: true,
        verified: false
      });
    }
  } else {
    res.render("wwd", {
      username: "strange",
      inserver: false,
      logged: false,
      verified: false
    });
  }
});

router.get("/yourroles", isAuthorized, async (req, res) => {
  try {
    const response = await utils.getMemberRoles("402555684849451028", req.user.discordId);
    if (response) {
      res.render("yourroles", {
        username: req.user.username,

        logged: true,
        roles: response
      })
    } else {
      res.status(500).send("Something happened!");
    }
  } catch (err) {
    console.log(err)
    res.status(500).send("Something happened! " + err);
  }
})

router.get('/rules', (req, res) => {
  if (req.user) {
    res.render("wwdrules", {
      username: req.user.username,

      logged: true
    });
  } else {
    res.render("wwdrules", {
      username: "strange",
      guilds: [],
      logged: false
    });
  }
});

router.get("/wm", isAuthorizedVerified, async (req, res) => {
  const msgDocument = await wm.find();
  const guilds = await utils.getUserGuilds(req.user.discordId);
  const guild = guilds.find(e => e.id === "402555684849451028")
  const perms = getPermissions(guild.permissions);
  if (perms.has("ADMINISTRATOR") && req.query && req.query.delete) {
    if (!msgDocument[req.query.delete]) return res.status(404).redirect("/wwd/wm");
    else await msgDocument[req.query.delete].deleteOne();
    return res.status(200).redirect("/wwd/wm");
  }

  const tosee = new Map();
  for (let i in msgDocument) {
    const user = await DiscordUser.findOne({ discordId: msgDocument[i].author });
    if (user) tosee.set(msgDocument[i].author, user.username + " (" + user.discordId + ")");
  }
  res.render('wm', {
    username: req.user.username,

    logged: true,
    media: msgDocument,
    authors: tosee,
    admin: perms.has("ADMINISTRATOR")
  })
})

router.get("/wm/pending", isAuthorizedAdmin, async (req, res) => {
  const msgDocument = await wmpending.find();
  if (req.query && req.query.delete) {
    if (!msgDocument[req.query.delete]) return res.status(404).redirect("/wwd/wm/pending");
    else await msgDocument[req.query.delete].deleteOne();
    return res.status(200).redirect("/wwd/wm/pending");
  }

  if (req.query && req.query.accept) {
    const a = msgDocument[req.query.accept];
    if (!a) return res.status(404).redirect("/wwd/wm/pending");
    await new wm({
      title: a.title,
      description: a.description,
      link: a.link,
      date: a.date,
      author: a.author
    }).save();
    await a.deleteOne();
    return res.status(200).redirect("/wwd/wm/pending");
  }

  const tosee = new Map();
  for (let i in msgDocument) {
    const user = await DiscordUser.findOne({ discordId: msgDocument[i].author });
    if (user) tosee.set(msgDocument[i].author, user.username + " (" + user.discordId + ")");
  }
  res.render('wmpending', {
    username: req.user.username,

    logged: true,
    media: msgDocument,
    authors: tosee
  })
})


router.get("/wm/add", isAuthorizedVerified, async (req, res) => {
  const guilds = await utils.getUserGuilds(req.user.discordId);
  const guild = guilds.find(e => e.id === "402555684849451028")
  const perms = getPermissions(guild.permissions);
  res.render("wmadd", {
    username: req.user.username,

    logged: true,
    admin: perms.has("ADMINISTRATOR"),
    status: 200
  })
});

router.post("/wm/add", isAuthorizedVerified, async (req, res) => {
  try {
    const guilds = await utils.getUserGuilds(req.user.discordId);
    const guild = guilds.find(e => e.id === "402555684849451028")
    const perms = getPermissions(guild.permissions);
    if (req.body && req.body.title && req.body.desc) {
      if (req.body.title.length > 250) return res.status(400).render('wmadd', {
        username: req.user.username,

        logged: true,
        status: 400,
        admin: perms.has("ADMINISTRATOR"),
      });
      if (req.body.link.length > 250) return res.status(400).render('wmadd', {
        username: req.user.username,

        logged: true,
        status: 400,
        admin: perms.has("ADMINISTRATOR"),
      })
      if (req.body.desc.length > 2000) return res.status(400).render('wmadd', {
        username: req.user.username,

        logged: true,
        status: 400,
        admin: perms.has("ADMINISTRATOR"),
      });
      let webhook;
      const embed = new Discord.MessageEmbed()
      if (perms.has("ADMINISTRATOR")) {
        await new wm({
          author: req.user.discordId,
          title: req.body.title,
          link: req.body.link,
          description: req.body.desc,
          date: new Date(),
        }).save();
        webhook = new Discord.WebhookClient(process.env.TID, process.env.TTOKEN);
      } else {
        await new wmpending({
          author: req.user.discordId,
          title: req.body.title,
          link: req.body.link,
          description: req.body.desc,
          date: new Date(),
        }).save();
        embed.setTitle("New multimedia for approve")
        webhook = new Discord.WebhookClient(process.env.RID, process.env.RTOKEN);
      }

      embed.setTitle(req.body.title)
        .setURL(req.body.link)
        .setDescription(req.body.desc)
        .setColor("RANDOM")
        .addField("Author", `${req.user.username} / ${req.user.discordId} / <@${req.user.discordId}>`)
      await webhook.send(embed)
      res.status(201).render('wmadd', {
        username: req.user.username,

        logged: true,
        status: 201,
        admin: perms.has("ADMINISTRATOR"),
      });
    } else res.status(400).render('wmadd', {
      username: req.user.username,

      logged: true,
      status: 400,
      admin: perms.has("ADMINISTRATOR"),
    });
  } catch (err) {
    console.log(err)
    res.status(500).render('wmadd', {
      username: req.user.username,

      logged: true,
      status: 500,
      admin: perms.has("ADMINISTRATOR"),
    });
  }
})

router.get("/wm/qualifiers", isAuthorized, async (req, res) => {
  res.render('wmq', {
    username: req.user.username,

    logged: true,
  });
})

router.get('/wwr', isAuthorizedAdmin, async (req, res) => {
  const msgDocument = await wwr.find();
  if (req.query && req.query.delete) {
    if (!msgDocument[req.query.delete]) return res.status(404).redirect("/wwd/wwr");
    else await msgDocument[req.query.delete].deleteOne();
    return res.status(200).redirect("/wwd/wwr");
  }
  const tosee = new Map();
  for (let i in msgDocument) {
    const user = await DiscordUser.findOne({ discordId: msgDocument[i].author });
    if (user) tosee.set(msgDocument[i].author, user.username + " (" + user.discordId + ")");
  }
  res.render('wwr', {
    username: req.user.username,

    logged: true,
    ideas: msgDocument,
    authors: tosee
  })
})

router.get('/wwr/submit', isAuthorizedVerified, async (req, res) => {
  const msgDocument = await wwr.findOne({ author: req.user.discordId });
  if (msgDocument) return res.status(403).render('wwrsubmit', {
    username: req.user.username,

    logged: true,
    status: 403
  });
  res.render('wwrsubmit', {
    username: req.user.username,

    logged: true,
    status: 200
  });
})

router.post('/wwr/submit', isAuthorizedVerified, async (req, res) => {
  try {
    if (req.body && req.body.title && req.body.desc) {
      if (req.body.title.length > 250) return res.status(400).render('wwrsubmit', {
        username: req.user.username,

        logged: true,
        status: 400
      });
      if (req.body.desc.length > 2000) return res.status(400).render('wwrsubmit', {
        username: req.user.username,

        logged: true,
        status: 400
      });
      const msgDocument = await wwr.findOne({ author: req.user.discordId });
      if (msgDocument) {
        return res.status(403).render('wwrsubmit', {
          username: req.user.username,

          logged: true,
          status: 403
        });
      }
      await new wwr({
        author: req.user.discordId,
        title: req.body.title,
        description: req.body.desc,
        date: new Date(),
      }).save();
      const webhook = new Discord.WebhookClient(process.env.WID, process.env.WTOKEN);
      const embed = new Discord.MessageEmbed()
        .setAuthor("New Wubbzy Wednesday idea")
        .setTitle(req.body.title)
        .setDescription(req.body.desc)
        .setColor("RANDOM")
        .addField("Author", `${req.user.username} / ${req.user.discordId} / <@${req.user.discordId}>`)
      await webhook.send(embed)
      res.status(201).render('wwrsubmit', {
        username: req.user.username,

        logged: true,
        status: 201
      });
    } else res.status(400).render('wwrsubmit', {
      username: req.user.username,

      logged: true,
      status: 400
    });
  } catch (err) {
    console.log(err)
    res.status(500).render('wwrsubmit', {
      username: req.user.username,

      logged: true,
      status: 500
    });
  }
})

router.get("/appeal", async (req, res) => {
  if (!req.user) return res.status(401).redirect("/");
  try {
    const algo = await bans.findOne({ guildId: "402555684849451028", userId: req.user.discordId })
    if (algo) return res.status(403).send("You already submitted your appeal");
    const banss = await utils.getGuildBans("402555684849451028")
    if (banss) {
      const ban = banss.find(e => e.user.id === req.user.discordId);
      if (ban) {
        res.status(200).render("bans", {
          username: req.user.username,

          logged: true,
          ban: ban
        })
      } else {
        res.status(403).send("You're not banned");
      }
    } else {
      res.status(500).send("Algo pasó!");
    }
  } catch (err) {
    res.status(500).send("Something happened" + err)
  }
})

router.post("/appeal", async (req, res) => {
  if (!req.user) return res.status(401).redirect("/");
  if (!req.body) return res.status(400).send("You haven't sent anything");
  if (!req.body.reason) return res.status(400).send("You have not put the reason");
  const esto = await utils.getGuildBans("402555684849451028");
  const ver = esto.find(e => e.user.id === req.user.discordId);
  if (!ver) return res.status(403).send("You're not banned");
  try {
    const algo = await bans.findOne({ guildId: "402555684849451028", memberId: req.user.discordId });
    if (algo) return res.status(403).send("You already submitted your appeal");
    const algo2 = new bans({
      guildId: "402555684849451028",
      userId: req.user.discordId,
      reason: req.body.reason,
      additional: req.body.additional || "*No additional*"
    })
    await algo2.save()
    res.status(201).render("appcompleted", {
      username: req.user.username,

      logged: true,
    })
  } catch (err) {
    res.status(500).send("Something happened" + err);
  }
})

router.get("/appeals", isAuthorizedAdmin, async (req, res) => {
  const banss = await bans.find();
  if (req.query && req.query.unban) {
    if (!banss[req.query.unban]) return res.status(404).redirect("/wwd/appeals");
    else {
      const doc = banss[req.query.unban];
      await fetch("https://discord.com/api/v6/guilds/402555684849451028/bans/" + banss[req.query.unban].userId, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`
        }
      });
      await banss[req.query.unban].deleteOne();
      return res.status(200).redirect("/wwd/appeals");
    }
  }
  if (req.query && req.query.delete) {
    if (!banss[req.query.delete]) return res.status(404).redirect("/wwd/appeals");
    await banss[req.query.delete].deleteOne();
    return res.status(200).redirect("/wwd/appeals");
  }
  const tosee = new Map();
  for (let i in banss) {
    const user = await DiscordUser.findOne({ discordId: banss[i].userId });
    if (user) tosee.set(banss[i].userId, user.username + " (" + user.discordId + ")");

  }
  res.render('appeals', {
    username: req.user.username,

    logged: true,
    appeals: banss,
    authors: tosee
  })
})

module.exports = router;