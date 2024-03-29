import dotenv from "dotenv";
import express from "express";
import puppeteer from "puppeteer";
import {
  crawlUrl,
  emailFieldID,
  loginButtonSelector,
  mainDivClassName,
  modalSelector,
  password,
  passwordFieldID,
  postImgSelector,
  replyImgSelector,
  seeMoreSelector,
  spanClickSelector,
  username,
} from "./const.js";
import fs from "fs";
import https from "https";
import axios from "axios";
dotenv.config();

const filename = "result.txt";
const filePath = "./images";
const app = express();
const port = process.env.PORT || 3000;

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: null,
});
const page = await browser.newPage();

app.get("/", (req, res) => {
  findAndRemoveElement();
  res.send("continute");
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

function delay(time = 3000) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const startPage = async () => {
  console.log("Start page");
  try {
    await page.goto(crawlUrl, { waitUntil: "load" });
    await page.setViewport({ width: 1080, height: 1024 });
    await createFolder();
    await cleanFile();
    await closeModal();
    // await login();

    // await autoScroll();
    // await page.waitForNavigation();
    // let crawlElements = await page.$("123");
    await delay();
    // await login();
    // await delay(30000);
    await findAndRemoveElement();
  } catch (err) {
    console.log(err);
    // await closeModal();
    await findAndRemoveElement();
  }
};

const closeModal = async () => {
  // await page.waitForSelector('[aria-label="Close"]', { visible: true });

  const closeButton = await page.$('[aria-label="Close"]');
  if (closeButton) {
    closeButton.click();
    await delay(1000);
  }
};

const login = async () => {
  await delay();

  await page.waitForSelector(emailFieldID);
  await page.type(emailFieldID, username);

  await page.waitForSelector(passwordFieldID);
  await page.type(passwordFieldID, password);

  // await page.type(emailFieldID, username);
  // await page.type(passwordFieldID, password);
  // await delay();
  const loginButton = await page.$(loginButtonSelector);
  if (loginButton) {
    console.log("Found the login button");
    // For example, to click the button:
    await loginButton.click();
  } else {
    console.log("Login button not found");
  }
};

const findAndRemoveElement = async () => {
  page.on("console", (msg) => console.log("[PAGE LOG]:", msg.text()));
  console.log("[findAndRemoveElement]");

  const crawlElementsSelector = ".x1yztbdb.x1n2onr6.xh8yej3.x1ja2u2z";
  let crawlElements = await page.$$(crawlElementsSelector);
  let postIndex = 1;

  while (true) {
    outerLoop: for (let parentEl of crawlElements) {
      // if (postIndex == 163 || postIndex == 381) {
      //   postIndex++;
      //   continue outerLoop;
      // }
      const spanSelector = "span";
      const aTag = await parentEl.$$("a");
      console.log("[aTag.length]:", aTag.length);
      const spans = await parentEl.$$(spanClickSelector);
      // console.log("[spans.length]:", spans.length);
      let innerText = "";
      let imgUrl = [];
      for (let span of spans) {
        const text = await span.evaluate((span) => span.innerText, span);
        if (
          text === "View more answers" ||
          text === "View more comments" ||
          checkStringViewAll(text) ||
          text === "View 1 reply"
        ) {
          if (span) {
            const elementContainsLink = await span.evaluate((element) => {
              const link = element.querySelector("a[href]");
              return !!link;
            });
            // const elementContainsLink = await span.$eval(
            //   selector,
            //   (element) => {
            //     const link = element.querySelector("a[href]");
            //     return !!link;
            //   }
            // );
            if (!elementContainsLink) {
              await span.click();
              await delay(1000);
            }
          }
          let modalFound = true;

          await page
            .waitForSelector(modalSelector, { timeout: 5000 })
            .catch((e) => {
              console.log("Modal not found or did not appear within 5 seconds");
              modalFound = false;
            });
          if (modalFound) {
            const modal = await page.$(modalSelector);
            if (modal) {
              const spansModal = await modal.$$eval(spanClickSelector, (el) => {
                return el[0].tagName.toLowerCase() === "span";
              });

              for (let i = 0; i < spansModal.length; i++) {
                const spanModal = spansModal[i];
                const spanModalText = await page.evaluate(
                  (span) => span.innerText,
                  spanModal
                );
                if (
                  spanModalText === "View more answers" ||
                  spanModalText === "View more comments" ||
                  checkStringViewAll(spanModalText) ||
                  spanModalText === "View 1 reply"
                ) {
                  if (modal && spanModal) {
                    await spanModal.click();
                    // break;
                  }
                }
              }
              await delay(1000);
              await clickSeeMore(modal);
              innerText = removeUnnecessaryStrPath(
                await page.evaluate((element) => element.innerText, modal)
              );
              await writeToFile(`[Post Index]: ${postIndex}`);
              await writeToFile(
                `----------------- Start Post --------------- \n`
              );
              await getImgUrl(modal, postIndex);
              console.log("[innerText]:", innerText);
              await writeToFile(`[Post content]: ${innerText} \n`);
              await writeToFile(
                `----------------- End Post --------------- \n`
              );
              await closeModal();
              postIndex++;
              // await page.evaluate((el) => el.remove(), parentEl);
            }
          }
          continue outerLoop;
        }
      }

      // await page.evaluate(() => {
      //   const divs = Array.from(document.querySelectorAll("div"));
      //   const seeMoreDivs = divs.filter((div) => div.innerText === "See more");
      //   seeMoreDivs.forEach((div) => {
      //     if (div) {
      //       div.click();
      //     }
      //   });
      // });

      await clickSeeMore(parentEl);

      innerText = removeUnnecessaryStrPath(
        await page.evaluate((element) => element.innerText, parentEl)
      );
      await writeToFile(`[Post Index]: ${postIndex}`);
      await writeToFile(`----------------- Start Post --------------- \n`);
      await getImgUrl(parentEl, postIndex);
      console.log("[innerText]:", innerText);
      await writeToFile(`[Post content]: ${innerText}`);
      await writeToFile(`----------------- End Post --------------- \n`);
      ``;
      postIndex++;
      if (postIndex % 50 === 0) {
        await delay(20000);
      }
      // await page.evaluate((el) => el.remove(), parentEl);
    }

    // Re-query the elements to see if more work is needed
    // await delay();

    crawlElements.map(async (parentEl) => {
      await page.evaluate((el) => el.remove(), parentEl);
    });
    await delay();
    crawlElements = await page.$$(crawlElementsSelector);

    // console.log("[crawlElements.length]:", crawlElements.length);
    // if (crawlElements.length === 0) {
    //   break;
    // }
  }
  console.log("[EXIT LOOP]");
};

async function autoScroll() {
  console.log("[AutoScroll]");
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      var totalHeight = 0;
      var distance = 100;

      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

const getImgUrl = async (parentEl, postIndex) => {
  const postImages = await parentEl.$$(postImgSelector);
  const replyImages = await parentEl.$$(replyImgSelector);

  const postImagesUrl = await Promise.all(
    postImages.map(async (img) => {
      const src = await img.getProperty("src");
      return src.jsonValue();
    })
  );

  const replyImagesUrl = await Promise.all(
    replyImages.map(async (img) => {
      const srcProperty = await img.getProperty("src");
      const src = await srcProperty.jsonValue(); // Convert to string
      if (!src.includes("emoji") && !src.includes("static.xx")) {
        return src; // Return src only if it does not contain "emoji"
      }
      return null; // Return null if it contains "emoji"
    })
  );

  const filteredReplyImagesUrl = replyImagesUrl.filter((url) => url !== null);
  const filteredPostImagesUrl = postImagesUrl.filter((url) => url !== null);

  await createFolder(postIndex);
  const basePath = `${filePath}/${postIndex}`;

  for (let i = 0; i < filteredPostImagesUrl.length; i++) {
    const img = filteredPostImagesUrl[i];
    if (img) {
      const fullImgPath = `${basePath}/post_img_${i}.png`;
      await downloadImageAsync(img, fullImgPath);
    }
  }

  for (let i = 0; i < filteredReplyImagesUrl.length; i++) {
    const img = filteredReplyImagesUrl[i];
    if (img) {
      const fullImgPath = `${basePath}/reply_img_${i}.png`;
      await downloadImageAsync(img, fullImgPath);
    }
  }

  await downloadFiles(parentEl, postIndex);

  // for (let img of filteredReplyImagesUrl) {
  //   if (img) {
  //     await writeToFile(`[Reply images]: ${img}`);
  //   }
  // }

  // await writeToFile(`[Post images]: ${postImagesUrl}`);
  // await writeToFile(`[Reply images]: ${replyImagesUrl}`);

  return;
};

async function writeToFile(content) {
  fs.appendFile(filename, `${content}\n`, "utf8", (error) => {
    if (error) {
      console.error("Error writing file:", error);
    } else {
      console.log("File written successfully");
    }
  });
}

async function cleanFile() {
  fs.writeFile(filename, ``, "utf8", (error) => {
    if (error) {
      console.error("Error writing file:", error);
    } else {
      console.log("File written successfully");
    }
  });
}

const removeUnnecessaryStrPath = (original) => {
  let text = original;
  text = text.replace(/All reactions:/g, "");
  text = text.replace(/Like/g, "");
  text = text.replace(/Top comments/g, "");
  text = text.replace(/Comment/g, "");
  text = text.replace(/Reply/g, "");
  text = text.replace(/Share/g, "");
  text = text.replace(/Edited/g, "");
  text = text.replace(/Write an answer…/g, "");
  text = text.replace(/Write a public comment…/g, "");
  text = text.replace(/\b\d+\s+shares?\b/gi, "");

  text = text.replace(/\d+\s+comments?/g, "");
  text = text.replace(/^\s*\d+\s*$/gm, "");

  // Step 2: Remove all time indicators like "10 w", "1 w", "1 y", "1h"
  text = text.replace(/\b\d+\s+[wmyhd]\b/g, "");
  text = text.replace(/\b\d+\s*[wmyhd]\b/g, "");

  // Replace three or more consecutive newline sequences with just two
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
};

const downloadImage = (url, path) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        // Check if the request was successful
        if (res.statusCode === 200) {
          // Pipe the image data to a file
          const writeStream = fs.createWriteStream(path);
          res.pipe(writeStream);

          writeStream.on("finish", () => {
            writeStream.close();
            console.log("Download and save completed.");
            resolve();
          });
        } else {
          reject(
            new Error(
              `Failed to download image. Status code: ${res.statusCode}`
            )
          );
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });

async function downloadImageAsync(url, path) {
  try {
    await downloadImage(url, path);
    console.log("Image successfully downloaded and saved to", path);
    // Proceed with any other logic after successful download
  } catch (error) {
    console.error("Error downloading the image:", error.message);
    // Handle errors, like logging them or falling back to alternative logic
  }
}

const createFolder = (postIndex) => {
  try {
    let folderPath = "";
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath);
    }
    if (postIndex) {
      folderPath = `${filePath}/${postIndex}`;
      // folderPath = `./file/${postIndex}`;
    } else {
      // folderPath = "./file";
    }

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
      console.log("Folder created successfully.");
    } else {
      console.log("Folder already exists.");
    }
  } catch (err) {
    console.error("Error creating folder:", err);
  }
};

const clickSeeMore = async (parentEl) => {
  const seeMoreDivs = await page.$$(seeMoreSelector);
  for (const div of seeMoreDivs) {
    const isSeeMore = await parentEl.evaluate(
      // (el) => el.textContent.trim() === "See more",
      (el) => el.textContent === "See more",
      div
    );
    if (isSeeMore) {
      // Scroll the div into view
      await parentEl.evaluate((el) => el.scrollIntoView(), div);
      // await delay(500);

      try {
        await div.click();
      } catch (error) {
        await parentEl.evaluate((el) => el.click(), div);
      }
    }
  }
  await delay(1000);
};

function checkStringViewAll(str) {
  const regex = /^View all \d+ replies$/;
  return regex.test(str);
}

const downloadFiles = async (parentEl, postIndex) => {
  const links = await parentEl.$$eval(
    `a[href*="drive.google.com/file"]`,
    (anchors) => anchors.map((anchor) => anchor.href)
  );

  await Promise.allSettled(
    links.map(async (link, index) => {
      try {
        const fullFilePath = `${basePath}/file_${index}.pdf`;
        await downloadFile(link, fullFilePath);
      } catch (err) {
        console.log("[err download pdf]:", err);
      }
    })
  );
};

const downloadFile = async (url, path) => {
  axios({
    method: "GET",
    url: url,
    responseType: "stream",
  })
    .then((response) => {
      const writer = fs.createWriteStream(path);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    })
    .then(() => {
      console.log(`Successfully downloaded file.`);
    })
    .catch((error) => {
      console.error(`Failed to download file`, error);
    });
};

await startPage();
