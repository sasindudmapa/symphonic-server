/** @format */

import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import path, { resolve } from "path";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPalette, getColor } from "colorthief";
import * as dotenv from "dotenv";

// import auth from "/Middleware/AuthMidlleware";

//app config
dotenv.config();
const port = 9000;
const app = express();

//app use
app.use(cors());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));
app.use("/songs", express.static(path.join(path.resolve(), "songs")));
app.use("/songimg", express.static(path.join(path.resolve(), "songimg")));

// console.log(path.resolve());

//Storage for Assets

//Artist storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

//Song storage
const songStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "songs");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const songUploads = multer({ storage: songStorage });

//song image storage
const songImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "songimg");
  },
  filename: (req, res, cb) => {
    cb(null, file.originalname);
  },
});

const songImgUpload = multer({ storage: songImgStorage });

//DB Config
const passwordDb = process.env.DB_PASSWORD;
const dbUrl = `mongodb+srv://sasindudilshara57:${passwordDb}@cluster0.gl9tvuq.mongodb.net/?retryWrites=true&w=majority`;

//COLLECTIONS

const artistSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  userName: String,
  nameInLower: String,
  password: String,
  profilePhoto: String,
  coverPhoto: String,
  dateOfBirth: String,
  songs: { type: [String], default: undefined, requireed: false },
  albums: { type: [String], default: undefined, required: false },
  fans: { type: Number, default: 0, required: false },
});

const songSchema = new mongoose.Schema({
  songName: String,
  artistName: String,
  nameInLower: String,
  albumName: String,
  tags: { type: [String], default: undefined },
  year: Number,
  coverPhoto: String,
  audioTrack: String,
  likes: { type: Number, required: false, default: 0 },
});

const albumSchema = new mongoose.Schema({
  albumName: String,
  nameInLower: String,
  description: String,
  artistName: String,
  coverPhoto: String,
  songs: {
    type: [songSchema],
    default: undefined,
  },
});

const searchSchema = new mongoose.Schema({
  songName: String,
  albumName: String,
  nameInLower: String,
});

const Artist = mongoose.model("Artist", artistSchema);
const Song = mongoose.model("Song", songSchema);
const Album = mongoose.model("Album", albumSchema);
const Search = mongoose.model("Search", searchSchema);

// const testNewSearch = new Search({
//   songName: "I love tou",
//   nameInLower: "i love tou",
//   albumName: "tee",
// })

// testNewSearch.save().then(()=>console.log("TEst Sved"))

//User Authentication
function auth(req, res, next) {
  const token = req.params.token;

  if (!token || token === "null") {
    res.status(400).send("unautharized");
  } else {
    try {
      const decoded = jwt.verify(token, "JWTSecret");
      req.user = decoded;
      next();
    } catch (e) {
      res.status(401).send("token is not valid");
    }
  }
}

//Function for extracting colors from an image
function col(img, next) {
  let imgUrl = `http://localhost:9000/${img}`;
  getPalette(imgUrl, 5).then((pallete) => {
    // console.log(pallete)
    next(pallete);
    // console.log(p)
  });
}

//ROUTES

//Register
app.post("/user/register", upload.array("userImages"), (req, res) => {
  console.log(req.body);
  Artist.find({ userName: req.body.userName }, (err, existingUser) => {
    if (err) {
      console.log(err);
    } else {
      if (existingUser.length === 0) {
        const newUser = new Artist({
          fullName: req.body.fullName,
          userName: req.body.userName,
          nameInLower: req.body.nameInLower,
          email: req.body.email,
          password: req.body.password,
          dateOfBirth: req.body.dateOfBirth,
          profilePhoto: req.files[0].path,
          coverPhoto: req.files[1].path,
        });

        //Create salt and hash
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) {
              console.log(err);
            } else {
              (newUser.password = hash),
                newUser.save().then((user) => {
                  jwt.sign(
                    { username: user.userName },
                    "JWTSecret",
                    (err, token) => {
                      if (err) {
                        console.log(err);
                      } else {
                        console.log(`token is ${token}`);
                        res.json({
                          token: token,
                          user: {
                            id: user.id,
                            name: user.userName,
                            email: user.email,
                            dateOfBirth: user.dateOfBirth,
                          },
                        });
                      }
                    }
                  );
                });
            }
          });
        });
      } else {
        res.status(208).send("Username is already being used");
      }
    }
  });
});

//check for username
app.post("/check/username", (req, res) => {
  console.log(req.body);
  Artist.find({ userName: req.body.userName }, (err, user) => {
    if (err) {
      console.log(err);
    } else {
      if (user.length > 0) {
        res.send("user name exists");
      } else {
        res.send("username available");
      }
    }
  });
});

//Login
app.post("/user/login", (req, res) => {
  console.log("came here");
  const passwordAsInput = req.body.password;
  Artist.find({ userName: req.body.userName }, (err, foundArtist) => {
    if (err) {
      console.log(err);
    } else {
      if (foundArtist.length === 0) {
        res.status(400).send("User name doesn't exist");
      } else {
        //comparing passwords
        bcrypt
          .compare(passwordAsInput, foundArtist[0].password)
          .then((isMatch) => {
            if (!isMatch) {
              return res.status(400).send("password does not match");
            } else {
              jwt.sign(
                { username: foundArtist[0].userName },
                "JWTSecret",
                (err, token) => {
                  if (err) {
                    console.log(err);
                  } else {
                    console.log(`token is ${token}`);
                    const user = {
                      token,
                      username: foundArtist[0].userName,
                    };
                    res
                      .status(201)
                      .send(user)
                      .then(() => {
                        console.log("token sent");
                      });
                  }
                }
              );
            }
          });
      }
    }
  });
});

//USER ACCOUNTS

//UPLOAD

//user account access
app.get("/user/account/:token/:username", auth, (req, res) => {
  const username = req.params.username;
  const userFromToken = req.user.username;
  //req's own account
  Artist.find({ userName: username }, (err, foundUser) => {
    if (err) {
      console.log(err);
    } else {
      if (foundUser.length === 0) {
        console.log("user does not exists");
        const errData = "User does not exist";
        res.status(400).send(errData);
      } else {
        let access;
        if (username === userFromToken) {
          access = true;
        } else {
          access = false;
        }
        const user = foundUser[0];
        const data = {
          access: access,
          username: user.userName,
          propic: user.profilePhoto,
          coverpic: user.coverPhoto,
          songs: user.songs,
          albums: user.albums,
          fans: user.fans,
        };

        res.status(201).send(data);
      }
    }
  });
});

//upload Song
app.post(
  "/user/:token/account/upload/song",
  auth,
  songUploads.array("media"),
  (req, res) => {
    const username = req.user.username;
    const user = req.body;
    // console.log(user.albumName.toLowerCase());

    function newSongSave() {
      const newSong = new Song({
        songName: user.songName,
        artistName: username,
        year: user.year,
        nameInLower: req.body.nameInLower,
        albumName: user.albumName,
        audioTrack: req.files[0].path,
        coverPhoto: req.files[1].path,
      });
      Song.save().then(() => {
        console.log("new song saved");
      });
    }

    function handleAlbumSave(inputAlbum, dbAlbums) {
      function newAlbumSave(album) {
        Album.find({ albumName: album }, (err, foundAlbum) => {
          if (err) {
            console.log(err);
          } else {
            if (foundAlbum.length === 0) {
              const newAlbum = new Album({
                nameInLower: user.albumName.toLowerCase(),
                albumName: user.albumName,
                artistName: username,
                coverPhoto: req.files[1].path,
                songs: [
                  {
                    songName: user.songName,
                    artistName: username,
                    nameInLower: user.songName.toLowerCase(),
                    albumName: user.albumName,
                    audioTrack: req.files[0].path,
                    coverPhoto: req.files[1].path,
                  },
                ],
              });
              newAlbum.save().then(() => {
                const newSearchSong = new Search({
                  songName: user.songName,
                  albumName: user.albumName,
                  nameInLower: req.body.nameInLower,
                });
                newSearchSong.save().then(() => {
                  console.log("new album saved");
                  res.status(201).send("Successfully added");
                });
              });
            } else {
              const newSong = new Song({
                songName: user.songName,
                artistName: username,
                year: user.year,
                nameInLower: req.body.nameInLower,
                albumName: user.albumName,
                audioTrack: req.files[0].path,
                coverPhoto: req.files[1].path,
              });

              Album.findOneAndUpdate(
                { albumName: user.albumName },
                { $addToSet: { songs: newSong } }
              ).then(() => {
                const newSearchSong = new Search({
                  songName: user.songName,
                  albumName: user.albumName,
                  nameInLower: req.body.nameInLower,
                });
                newSearchSong.save().then(() => {
                  console.log("new album saved");
                  res.status(201).send("Successfully added song the album");
                });
              });
            }
          }
        });
      }

      if (dbAlbums === undefined) {
        Artist.findOneAndUpdate(
          { userName: username },
          { albums: inputAlbum }
        ).then(() => {
          //call for handle album collection
          console.log("saved to artist");
          newAlbumSave(inputAlbum);
        });
      } else {
        Artist.findOneAndUpdate(
          { userName: username },
          { $addToSet: { albums: inputAlbum } }
        ).then(() => {
          //call for handle album collection
          console.log("saved to artist");

          newAlbumSave(inputAlbum);
        });
      }
    }

    Artist.find({ userName: username }, (err, artist) => {
      if (err) {
        console.log(err);
      } else {
        const songs = artist[0].songs;
        const albums = artist[0].albums;
        if (songs === undefined) {
          Artist.findOneAndUpdate(
            { userName: username },
            { songs: user.songName }
          ).then(() => {
            // newSongSave();
            handleAlbumSave(user.albumName, albums);
          });
        } else {
          if (songs.includes(user.songName)) {
            res
              .status(208)
              .send(
                "Another song from this name already exists in your account"
              );
          } else {
            Artist.findOneAndUpdate(
              { userName: username },
              { $addToSet: { songs: user.songName } }
            ).then(() => {
              // newSongSave();
              handleAlbumSave(user.albumName, albums);
            });
          }
        }
      }
    });
  }
);

//Upload an album
app.post(
  "/user/:token/account/upload/album",
  auth,
  songUploads.array("media"),
  (req, res) => {
    // console.log(req.files);
    const username = req.user.username;
    const user = req.body;
    const songs = [];
    for (let i = 1; i < req.files.length; i++) {
      songs.push(req.files[i]);
    }
    Artist.find({ userName: username }, (err, artist) => {
      if (err) {
        console.log(err);
      } else {
        Artist.findOneAndUpdate(
          { userName: username },
          { $addToSet: { albums: req.body.albumName } }
        ).then(() => {
          Artist.findOneAndUpdate(
            { userName: username },
            {
              $addToSet: {
                songs: songs.map((song) => {
                  return song.filename;
                }),
              },
            }
          ).then(() => {
            const songForTheNewAlbum = [];
            const firstSongForNewAlbum = new Song({
              songName: songs[0].filename,
              artistName: username,
              year: user.year,
              nameInLower: songs[0].filename.toLowerCase(),
              albumName: user.albumName,
              coverPhoto: req.files[0].path,
              audioTrack: songs[0].path,
            });

            const newAlbum = new Album({
              nameInLower: user.albumName.toLowerCase(),
              albumName: user.albumName,
              artistName: username,
              coverPhoto: req.files[0].path,
              songs: [firstSongForNewAlbum],
            });
            newAlbum.save().then(() => {
              for (let l = 1; l < songs.length; l++) {
                let newSong = new Song({
                  songName: songs[l].filename,
                  artistName: username,
                  year: user.year,
                  nameInLower: songs[l].filename.toLowerCase(),
                  albumName: user.albumName,
                  coverPhoto: req.files[0].path,
                  audioTrack: songs[l].path,
                });
                songForTheNewAlbum.push(newSong);
              }
              Album.findOneAndUpdate(
                { albumName: newAlbum.albumName },
                {
                  $addToSet: {
                    songs: songForTheNewAlbum.map((song) => {
                      return song;
                    }),
                  },
                }
              ).then(() => {
                for (let j = 0; j < songs.length; j++) {
                  const newSearchedSong = new Search({
                    songName: songs[j].filename,
                    nameInLower: songs[j].filename.toLowerCase(),
                    albumName: user.albumName,
                  });
                  newSearchedSong.save();
                }
                res.status(201).send("successfull");
              });
            });
          });
        });
      }
    });
  }
);

//fetch albums of one artist
app.get("/user/account/:username/fetch/:token/album", auth, (req, res) => {
  const username = req.params.username;

  Album.find({ artistName: username }, (err, foundAlbums) => {
    if (err) {
      console.log(err);
    } else {
      if (foundAlbums.length === 0) {
        res.status(208).send("no Albums or songs");
      } else {
        res.status(201).send(foundAlbums);
      }
    }
  });
});

//fetch songs from one album of one artist
app.get("/user/account/:artist/fetch/:token/album/:album", auth, (req, res) => {
  const albumName = req.params.album;
  const artist = req.params.artist;

  console.log(`${albumName} and ${artist}`);

  Album.find({ albumName: albumName }, (err, foundAlbums) => {
    if (err) {
      console.log(err);
    } else {
      foundAlbums.map((album) => {
        if (album.artistName === artist) {
          // console.log(album.coverPhoto)
          function sending(pallete) {
            const toF = [album.songs, pallete];
            res.status(201).send(toF);
          }
          col(album.coverPhoto, sending);
          // console.log(colorPal)
        }
      });
    }
  });
});

//fetch Songs of one artist
app.get("/user/account/songs/:token/:username", auth, (req, res) => {
  const username = req.params.username;

  Song.find({ artistName: username }, (err, songs) => {
    if (err) {
      console.log(err);
    } else {
      if (songs.length > 0) {
        res.status(201).send(songs);
      } else {
        res.status(208).send("no songs yet");
      }
    }
  });
});

//RANDOM FETCH ALBUM
app.get("/user/:token/random/album/:username", auth, (req, res) => {
  const username = req.params.username;
  Album.find({ artistName: username }, (err, foundAlbums) => {
    if (err) {
      console.log(err);
    } else {
      let listnumber = Math.floor(Math.random() * foundAlbums.length);
      res.status(201).send(foundAlbums[listnumber]);
    }
  });
});

//HOME
//
function swap(arr, idx1, idx2) {
  let temp = arr[idx1];
  arr[idx1] = arr[idx2];
  arr[idx2] = temp;
}

function bubbleSort(ar) {
  for (let i = ar.length; i > 0; i--) {
    for (let j = 0; j < i - 1; j++) {
      if (ar[j] > ar[j + 1]) {
        swap(ar, j, j + 1);
      }
    }
  }
  return ar;
}

//fetch artists
app.get("/user/:token/home/artists", auth, (req, res) => {
  Artist.find((err, allArtsits) => {
    if (err) {
      console.log(err);
    } else {
      //sorting the artists according to their number of fans
      for (let i = allArtsits.length - 1; i > 0; i--) {
        for (let j = 0; j < i; j++) {
          if (allArtsits[j].fans < allArtsits[j + 1].fans) {
            let temp = allArtsits[j];
            allArtsits[j] = allArtsits[j + 1];
            allArtsits[j + 1] = temp;
          }
        }
      }

      if (allArtsits.length > 6) {
        const toSendAr = [];
        for (let i = 0; i < 6; i++) {
          toSendAr.push(allArtsits[i]);
        }
        res.status(201).send(toSendAr);
      } else {
        res.status(201).send(allArtsits);
        // console.log(allArtsits)
      }
    }
  });
});

app.get("/user/:token/home/latestAlbums", auth, (req, res) => {
  Album.find((err, allAlbums) => {
    if (err) {
      console.log(err);
    } else {
      if (allAlbums.length < 6) {
        res.status(201).send(allAlbums);
      } else {
        const toSendAr = [];
        for (let i = 0; i < 6; i++) {
          toSendAr.push(allAlbums[i]);
        }
        res.status(201).send(toSendAr);
      }
      console.log(allAlbums);
    }
  });
});

app.get("/user/:token/home/songs", auth, (req, res) => {
  Album.find((err, allAlbums) => {
    if (err) {
      console.log(err);
    } else {
      const allSongs = [];
      allAlbums.map((album) => {
        album.songs.map((song) => {
          allSongs.push(song);
        });
      });

      //sorting the artists according to their number of fans
      for (let i = allSongs.length - 1; i > 0; i--) {
        for (let j = 0; j < i; j++) {
          if (allSongs[j].likes < allSongs[j + 1].likes) {
            let temp = allSongs[j];
            allSongs[j] = allSongs[j + 1];
            allSongs[j + 1] = temp;
          }
        }
      }

      if (allSongs.length > 6) {
        const toSendAr = [];
        for (let i = 0; i < 6; i++) {
          toSendAr.push(allSongs[i]);
        }
        res.status(201).send(toSendAr);
      } else {
        res.status(201).send(allSongs);
      }
      console.log("sended");
    }
  });
});

//SEARCH
app.get("/user/search/:token/:q/:item", (req, res) => {
  let item = new RegExp(req.params.item);
  let db;
  let toSendNe = [];
  let song;

  if (req.params.q === "Artist") {
    db = Artist;
  } else {
    db = Album;
  }
  db.find({ nameInLower: item }, (err, foundItems) => {
    if (err) {
      console.log(err);
    } else {
      if (req.params.q !== "Song") {
        foundItems.length === 0
          ? res.status(201).send(`No ${req.params.q}s`)
          : res.status(201).send([req.params.q, foundItems]);
      } else {
        const forS = [];
        Search.find({ nameInLower: item }, (err, foundSongNames) => {
          if (err) {
            console.log(err);
          } else {
            Album.find(
              { "songs.nameInLower": item },
              (e, foundAlbumsOfSongs) => {
                if (e) {
                  console.log(e);
                } else {
                  // Promise.all(
                  foundAlbumsOfSongs.map((album) => {
                    song = album.songs.find((s) => s.nameInLower === item);
                    console.log("si", song);
                    return song;
                  });
                  // );
                }
              }
            );

            // res.end();
            // console.log(forS, "is");
            // if (forS.length === 0) {
            //   res.status(201).send(`No ${req.params.q}s`);
            // } else {
            //   res.status(201).send([req.params.q, forS]);
            // }
          }
        });
      }
    }
  });
});

//LIKE SONG
app.get("/user/like/:token/:artist/:songName", auth, (req, res) => {
  const username = req.user.username;
  const artist = req.params.artist;
  const songName = req.params.songName;

  Artist.findOneAndUpdate();
});

// TEST ROUTES

//this route works
//auth test
app.get("/test/auth/:token", auth, (req, res) => {
  console.log(req.user);
  res.send("You gained access to this route");
});

//sending data test
app.get("/test/userdts/:token", auth, (req, res) => {
  // console.log(req.user);
  const username = req.user.username;
  Artist.find({ userName: username }, (err, user) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`the length is ${user.length}`);
      console.log(user);
      if (user.length > 0) {
        const data = {
          username: user[0].userName,
          propic: user[0].profilePhoto,
        };
        console.log(data);
        res.send(data);
      }
    }
  });
});

//album upload test
app.post(
  "/test/upload/:token",
  auth,
  songUploads.array("media"),
  (req, res) => {
    console.log(req.files);
  }
);
// let te;
// let teAR = [];
// let q = new RegExp("a");
// Album.find({ "songs.nameInLower": q }, (er, album) => {
//   if (er) {
//     console.log(er);
//   } else {
//     // console.log(album);
//     album.map((al) => {
//       te = al.songs.find((t) => t.nameInLower == q);
//       console.log(te);
//       teAR.push(te);
//     });
//     console.log(teAR);
//   }
// });

// const testsongObjData = new Song({
//   songName: "TEST SONGS",
//   artistName: "TEST ARTIST",
// })

// const allsongs = []
// for (let i = 0; i < 5; i++){
//   allsongs.push(testsongObjData)
// }

// const TestAlbum = new Album({
//   nameInLower : "TEST ALBUMasss HEREEEEEsdsdsdsdswwrE 233",
//   albumName: "TEST ALBUM HERE",
//   songs : [
//     allsongs[0]
//   ]
// })

// function testingAlbum(songs){
//   for (let k = 1; k < songs.length; k++){

//   }
// }

// TestAlbum.save().then(()=>{
//   Album.findOneAndUpdate(
//     {albumName: TestAlbum.albumName},
//     {$addToSet : {songs : allsongs.map((song)=>{return song})}}
//   ).then(()=>{
//     Album.find({albumName: TestAlbum.albumName}, (err, album)=>{
//       console.log(album[0].songs)
//     })
//   })
// })

//DB TEST
// const testname = "sa";
// const reg = new RegExp("s");
// console.log(reg);
// Artist.find({ userName: reg }, (err, users) => {
//   if (err) {
//     console.log(err);
//   } else {
//     console.log(users);
//   }
// });

//WHEN WORKING WITH ARRAYS IN MOGODB USE THEN()
// Artist.find({ userName: "sasindu3" }, (err, artist) => {
//   if (err) {
//     console.log(err);
//   } else {
//     const song = "testno 6";
//     // console.log(artist[0].songs);
//     if (artist[0].albums === undefined) {
//       Artist.findOneAndUpdate({ userName: "sasindu3" }, { albums: song }).then(
//         () => console.log("added")
//       );
//       // console.log("value is undefined");
//       // artist[0].songs.addToSet(song);
//     } else {
//       Artist.findOneAndUpdate(
//         { userName: "sasindu3" },
//         { $addToSet: { albums: song } }
//       ).then(() => console.log("added down "));
//     }
//   }
// }).then(() => {
//   Artist.find({ userName: "sasindu3" }, (er, artist) => {
//     // console.log(artist[0]);
//   });
// });

//app listen
mongoose
  .connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log("connected to the Database");
    app.listen(port, () => {
      console.log(`server started on port ${port}`);
    });
  });
